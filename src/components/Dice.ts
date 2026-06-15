/**
 * Dice: 2d6 with set-aside (Farkle-style) mechanics.
 *
 * Game flow:
 *   1. Player rolls both dice (throw 1)
 *   2. Player can either SET ASIDE 0, 1, or 2 dice and re-roll the rest
 *      (throw 2), or commit the current sum.
 *   3. They can keep going (throw 3) until all dice are set aside
 *      OR they've used 3 throws.
 *   4. The committed sum is the move.
 *
 * Bots use the same flow but the AI decides when to set aside.
 */
import * as THREE from 'three';
import { makeTween, Tween } from '../utils/animation';

export type DieIndex = 0 | 1;

export interface DiceState {
  /** Current values for each die. `null` = not yet rolled this throw. */
  values: [number | null, number | null];
  /** Which dice are set aside (locked from re-rolling). */
  locked: [boolean, boolean];
  /** Throws used: 0 = unrolled, 1-3 = each roll, 3 = max. */
  throwsUsed: number;
  readonly maxThrows: 3;
  /** Sum of locked dice + the latest un-locked dice values. */
  readonly currentSum: number;
  /** True if no further action is possible (all locked or max throws). */
  readonly isFinal: boolean;
}

const MAX_THROWS = 3;

export function newDiceState(): DiceState {
  return {
    values: [null, null],
    locked: [false, false],
    throwsUsed: 0,
    maxThrows: MAX_THROWS,
    get currentSum() {
      const a = this.values[0] ?? 0;
      const b = this.values[1] ?? 0;
      return a + b;
    },
    get isFinal() {
      // Final when at least one throw has happened AND (all dice locked OR max throws reached)
      if (this.throwsUsed === 0) return false;
      if (this.locked[0] && this.locked[1]) return true;
      if (this.throwsUsed >= this.maxThrows) return true;
      return false;
    }
  };
}

export class Dice {
  readonly mesh: THREE.Group;
  private dieMeshes: THREE.Group[] = [];
  private currentValues: [number, number] = [1, 1];
  get value(): [number, number] { return this.currentValues; }
  private currentTween: Tween | null = null;
  private pendingOnDone: (() => void) | null = null;

  constructor() {
    this.mesh = new THREE.Group();
    this.mesh.name = 'Dice';
    this.buildTwoCubes();
    this.mesh.position.set(0, 0.6, 0);
  }

  private buildTwoCubes(): void {
    const size = 0.5;
    const geo = new THREE.BoxGeometry(size, size, size);
    const dots = this.buildDotTextures();
    for (let i = 0; i < 2; i++) {
      const mats: THREE.MeshStandardMaterial[] = [];
      for (let f = 0; f < 6; f++) {
        const tex = dots[f]!;
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          color: 0xf5f0e8,
          roughness: 0.4,
          metalness: 0.05
        });
        mats.push(mat);
      }
      const cube = new THREE.Mesh(geo, mats);
      cube.castShadow = true;
      cube.receiveShadow = true;
      const wrapper = new THREE.Group();
      wrapper.add(cube);
      wrapper.position.set((i - 0.5) * 0.7, 0, 0);
      wrapper.name = `Die-${i}`;
      this.dieMeshes.push(wrapper);
      this.mesh.add(wrapper);
    }
  }

  private buildDotTextures(): THREE.Texture[] {
    const out: THREE.Texture[] = [];
    const dots: Record<number, [number, number][]> = {
      1: [[0.5, 0.5]],
      2: [[0.28, 0.72], [0.72, 0.28]],
      3: [[0.25, 0.75], [0.5, 0.5], [0.75, 0.25]],
      4: [[0.28, 0.72], [0.72, 0.72], [0.28, 0.28], [0.72, 0.28]],
      5: [[0.25, 0.75], [0.75, 0.75], [0.5, 0.5], [0.25, 0.25], [0.75, 0.25]],
      6: [[0.25, 0.75], [0.75, 0.75], [0.25, 0.5], [0.75, 0.5], [0.25, 0.25], [0.75, 0.25]]
    };
    for (let v = 1; v <= 6; v++) {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#F5F0E8';
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#1B2A4A';
      for (const [x, y] of dots[v]!) {
        ctx.beginPath();
        ctx.arc(x * 128, y * 128, 11, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      out.push(tex);
    }
    return out;
  }

  /**
   * Roll the dice with a real bounce: the dice tumbles through a
   * parabolic arc (up, then down) with continuous rotation, then
   * lands and bounces once before settling on the target faces.
   *
   * Total animation: 1100ms (was 800ms flat spin).
   * The rotation accumulates several full turns so the dice visibly
   * tumbles, then lands on the correct face.
   */
  roll(values: [number, number], onDone: () => void): void {
    if (values[0] < 1 || values[0] > 6 || values[1] < 1 || values[1] > 6) {
      throw new Error(`Dice.roll: values out of range: ${values}`);
    }
    this.currentValues = [values[0], values[1]];

    const startPositions = this.dieMeshes.map((d) => d.position.clone());
    const startEulers = this.dieMeshes.map((d) => d.rotation.clone());
    const startY = startPositions[0]!.y; // base Y (dice tray height)
    const spins = 4;
    const targetRotations: { x: number; z: number }[] = values.map((v) => this.faceUpRotation(v));

    // Parabolic arc: peak at t=0.45, then descend. Bounce at t=0.85 with decay.
    // Y(t) = base + peak * sin(πt) for [0, 0.5] then base + 0.25*peak * sin(2πt) for [0.5, 1.0]
    // Simplified: single-phase parabolic arc + small bounce
    const peak = 0.9; // height the dice rises

    this.currentTween = makeTween(
      { durationMs: 1100, ease: (t) => t }, // linear so the parabolic Y math is clean
      (t) => {
        // Parabolic Y: 4*peak*t*(1-t) for t in [0, 0.5], then bounce for [0.5, 1.0]
        let y: number;
        if (t < 0.5) {
          // Rising then falling: sin curve
          y = startY + peak * Math.sin(t * Math.PI * 2); // peaks at t=0.5
        } else {
          // Bounce: 2 small decaying bounces
          const t2 = (t - 0.5) * 2; // 0..1 in the second half
          y = startY + (peak * 0.3) * Math.sin(t2 * Math.PI * 2) * (1 - t2 * 0.5);
        }
        // Rotation: 4 full turns + landing at target face
        for (let i = 0; i < 2; i++) {
          const start = startEulers[i]!;
          const target = targetRotations[i]!;
          const toX = start.x + Math.PI * 2 * spins + target.x;
          const toZ = start.z + Math.PI * 2 * spins + target.z;
          this.dieMeshes[i]!.rotation.set(
            start.x + (toX - start.x) * t,
            start.y + Math.PI * 2 * spins * t,
            start.z + (toZ - start.z) * t
          );
          this.dieMeshes[i]!.position.set(
            startPositions[i]!.x,
            y,
            startPositions[i]!.z
          );
        }
      }
    );
    this.pendingOnDone = onDone;
  }

  /** Visual: snap a single die to a value (used when a die is "locked" — no animation). */
  snapToValue(die: DieIndex, value: number): void {
    if (value < 1 || value > 6) throw new Error(`Dice.snapToValue: value out of range: ${value}`);
    this.currentValues[die] = value;
    const rot = this.faceUpRotation(value);
    this.dieMeshes[die]!.rotation.set(rot.x, 0, rot.z);
  }

  update = (dtMs: number): void => {
    if (!this.currentTween) return;
    const stillRunning = this.currentTween.step(dtMs);
    if (!stillRunning) {
      const cb = this.pendingOnDone;
      this.currentTween = null;
      this.pendingOnDone = null;
      if (cb) cb();
    }
  };

  private faceUpRotation(value: number): { x: number; z: number } {
    const map: Record<number, { x: number; z: number }> = {
      1: { x: 0, z: 0 },
      2: { x: Math.PI / 2, z: 0 },
      3: { x: Math.PI, z: 0 },
      4: { x: -Math.PI / 2, z: 0 },
      5: { x: 0, z: -Math.PI / 2 },
      6: { x: 0, z: Math.PI / 2 }
    };
    return map[value]!;
  }
}
