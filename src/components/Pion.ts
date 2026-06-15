/**
 * Pion (player piece). Slice 4: each pion can wear a batik "costume"
 * — a procedurally-drawn motif wrapped onto the body and head.
 *
 * Costumes are a `PionSpec.costume` (pattern + colors). If absent, the
 * pion falls back to a solid `color`.
 */
import * as THREE from 'three';
import { makeTween, Tween } from '../utils/animation';
import { easeInOutCubic } from '../utils/math';
import { makeBatikTexture, type BatikPattern } from '../scene/BatikTextures';

export interface PionCostume {
  readonly pattern: BatikPattern;
  readonly fg: number;
  readonly bg: number;
  readonly accent: number;
}

export interface PionSpec {
  readonly index: number;
  readonly name: string;
  readonly color: number;
  readonly costume?: PionCostume;
}

export class Pion {
  readonly index: number;
  readonly name: string;
  readonly mesh: THREE.Group;
  private currentSquare: number = 0; // 0 = off-board (start)
  private bodyMat: THREE.MeshStandardMaterial;
  private tweens: Tween[] = [];
  private pendingOnDone: (() => void) | null = null;
  private baseHeight: number;

  constructor(spec: PionSpec, baseHeight: number) {
    this.index = spec.index;
    this.name = spec.name;
    this.baseHeight = baseHeight;

    this.mesh = new THREE.Group();
    this.mesh.name = `Pion-${spec.name}`;

    // Base disc
    const baseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.08, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1B2A4A, roughness: 0.6, metalness: 0.1 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.04;
    base.castShadow = true;
    this.mesh.add(base);

    // Body — uses batik if costume is provided, else solid color
    const bodyGeo = new THREE.CapsuleGeometry(0.18, 0.32, 8, 16);
    if (spec.costume) {
      const tex = makeBatikTexture(spec.costume.pattern, {
        fg: spec.costume.fg,
        bg: spec.costume.bg,
        accent: spec.costume.accent,
        size: 128
      });
      this.bodyMat = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.08
      });
    } else {
      this.bodyMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.45, metalness: 0.1 });
    }
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.position.y = 0.42;
    body.castShadow = true;
    this.mesh.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const head = new THREE.Mesh(headGeo, this.bodyMat);
    head.position.y = 0.78;
    head.castShadow = true;
    this.mesh.add(head);
  }

  get square(): number { return this.currentSquare; }

  /**
   * Swap the pion's costume at runtime (used when the player picks a
   * new costume in the menu between matches). Replaces the body
   * material's map and color.
   */
  setCostume(costume: { pattern: string; fg: number; bg: number; accent: number; size?: number }): void {
    const tex = makeBatikTexture(costume.pattern as BatikPattern, {
      fg: costume.fg,
      bg: costume.bg,
      accent: costume.accent,
      size: costume.size ?? 128
    });
    this.bodyMat.map = tex;
    this.bodyMat.color.set(0xffffff);
    this.bodyMat.needsUpdate = true;
  }

  /**
   * Per-frame updater. Drives the step-by-step move chain and fires the
   * pending onDone when the chain finishes.
   */
  update = (dtMs: number): void => {
    if (this.tweens.length === 0) return;
    const current = this.tweens[0]!;
    const stillRunning = current.step(dtMs);
    if (!stillRunning) {
      this.tweens.shift();
      if (this.tweens.length === 0) {
        const cb = this.pendingOnDone;
        const onDone = cb;
        this.pendingOnDone = null;
        if (onDone) onDone();
      }
    }
  };

  /**
   * Animate the pion along an arbitrary 3D curve (used for snake slides
   * and ladder climbs). Optional `extraOffset` adds a y-bob on top of
   * the curve for the "climbing" feel.
   */
  moveAlongCurve(
    curve: THREE.Curve<THREE.Vector3>,
    durationMs: number,
    targetSquare: number,
    onDone: () => void,
    extraOffset?: (t: number) => number
  ): void {
    this.tweens = [];
    this.pendingOnDone = null;
    // Lift the curve to sit on top of the pion's base, so the body
    // (which is at baseHeight) doesn't go through the ground
    const lifted = curve.clone();
    // Sample one point at t=0 to know the curve's start Y
    const startPt = lifted.getPoint(0);
    const yOffset = this.baseHeight - startPt.y;
    this.tweens = [
      makeTween({ durationMs, ease: easeInOutCubic }, (t) => {
        const p = lifted.getPoint(t);
        const bob = extraOffset ? extraOffset(t) : 0;
        this.mesh.position.set(p.x, p.y + yOffset + bob, p.z);
      })
    ];
    this.pendingOnDone = () => {
      this.currentSquare = targetSquare;
      const finalPt = lifted.getPoint(1);
      this.mesh.position.set(finalPt.x, finalPt.y + yOffset, finalPt.z);
      onDone();
    };
  }

  /**
   * Animate from current square to a new square, stepping one square at a
   * time so each step can have a small hop.
   */
  moveTo(targetSquare: number, getPos: (sq: number) => THREE.Vector3, onDone: () => void): void {
    if (targetSquare === this.currentSquare) { onDone(); return; }
    // Cancel any in-flight chain
    this.tweens = [];
    this.pendingOnDone = null;
    const stepCount = Math.abs(targetSquare - this.currentSquare);
    const dir = Math.sign(targetSquare - this.currentSquare);
    const newTweens: Tween[] = [];
    for (let i = 0; i < stepCount; i++) {
      const fromSq = this.currentSquare + dir * i;
      const toSq = fromSq + dir;
      const fromPos = getPos(fromSq);
      const toPos = getPos(toSq);
      newTweens.push(makeTween({ durationMs: 220, ease: easeInOutCubic }, (t) => {
        const x = fromPos.x + (toPos.x - fromPos.x) * t;
        const z = fromPos.z + (toPos.z - fromPos.z) * t;
        const hop = Math.sin(t * Math.PI) * 0.18;
        this.mesh.position.set(x, this.baseHeight + hop, z);
      }));
    }
    this.tweens = newTweens;
    this.pendingOnDone = () => {
      this.currentSquare = targetSquare;
      const finalPos = getPos(targetSquare);
      this.mesh.position.set(finalPos.x, this.baseHeight, finalPos.z);
      onDone();
    };
  }

  /**
   * Snap without animation. Used for the initial setup and for the
   * "off-board" position at game start.
   */
  snapToSquare(square: number, getPos: (sq: number) => THREE.Vector3): void {
    this.currentSquare = square;
    if (square === 0) {
      // Park off-board; we use a position just below square 1
      const p = getPos(1);
      this.mesh.position.set(p.x, this.baseHeight, p.z + 0.6);
    } else {
      const p = getPos(square);
      this.mesh.position.set(p.x, this.baseHeight, p.z);
    }
  }
}
