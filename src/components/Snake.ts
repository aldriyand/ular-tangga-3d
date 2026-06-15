/**
 * Snake visual. Slice 3: 9 distinct procedural shapes — one per snake
 * in the design doc. Each shape is generated from a list of control
 * points (start, end, plus per-style waypoints), fed through a
 * CatmullRomCurve3 and rendered as a TubeGeometry.
 *
 * Shape styles:
 *   - s-curve:     long sinusoidal S, classic serpent
 *   - coil:        one full revolution before descending
 *   - zigzag:      sharp angular spine
 *   - waves:       many small tight waves (centipede wiggle)
 *   - loop:        big circular loop then dive
 *   - spiral:      two stacked loops
 *   - arch:        gentle arch with a dip in the middle (lake)
 *   - scorpion:    straight then hook up at the head end
 *   - v-shape:     sharp V dipping low in the middle
 *
 * Each snake also has a culture-specific color tint so they're not all
 * the same red. Heads are larger than slice 1 and slightly different
 * per style.
 */
import * as THREE from 'three';
import type { Snake as SnakeData } from '../data/board';
import { squareToWorld } from '../data/path';

type SnakeStyle = 's-curve' | 'coil' | 'zigzag' | 'waves' | 'loop' | 'spiral' | 'arch' | 'scorpion' | 'v-shape';

interface SnakeStyleSpec {
  readonly style: SnakeStyle;
  /** Per-snake culture tint. Mostly ulos red, with small variations. */
  readonly color: number;
  /** Per-style body radius (tube thickness). */
  readonly radius: number;
  /** Number of control points along the path (more = smoother). */
  readonly samples: number;
  /** Optional loop/spiral parameters (revolutions, radius multiplier). */
  readonly loops?: number;
  readonly loopRadius?: number;
}

/** Per-snake style map. Snake names match the design doc. */
const SNAKE_STYLES: Record<string, SnakeStyleSpec> = {
  'Naga Banda':     { style: 's-curve',  color: 0xC41E3A, radius: 0.09, samples: 48 },
  'Ular Naga Jawa': { style: 'spiral',   color: 0x8B2A2A, radius: 0.10, samples: 64, loops: 1.5, loopRadius: 0.8 },
  'Buaya Putih':    { style: 'zigzag',   color: 0x6B6B6B, radius: 0.11, samples: 12 },
  'Lipan':          { style: 'waves',    color: 0x8B4513, radius: 0.07, samples: 64 },
  'Naga Sari':      { style: 'loop',     color: 0xB89A5A, radius: 0.09, samples: 48, loopRadius: 0.9 },
  'Ular Sawa':      { style: 'coil',     color: 0x9B3A1F, radius: 0.10, samples: 56, loops: 2, loopRadius: 0.6 },
  'Naga Tasik':     { style: 'arch',     color: 0x4A6FA5, radius: 0.09, samples: 40 },
  'Kalajengking':   { style: 'scorpion', color: 0x5A2D0C, radius: 0.10, samples: 28 },
  'Ular Kadal':     { style: 'v-shape',  color: 0x7A8B3A, radius: 0.10, samples: 24 }
};

/**
 * The dice sits at the center of the board. Its XZ footprint is roughly
 * 1.2 units wide (two cubes at ±0.35, size 0.5). We don't want any
 * snake tube to pass through the same XZ area (otherwise the dice
 * would be partially occluded by the snake).
 *
 * Two-stage defense:
 *   1. applyDiceKeepout(): push control points radially outward
 *   2. clampTubeToKeepout(): post-process the actual tube vertices
 *
 * Stage 1 alone is not enough because CatmullRomCurve3 can dip inward
 * between widely-spaced control points. Stage 2 is the real guarantee.
 *
 * Endpoints (start, end) are NEVER pushed — they have to land on
 * their tile.
 */
const DICE_KEEPOUT_RADIUS = 0.9;

/**
 * Push any intermediate control point that's inside the keep-out
 * circle outward to the edge of that circle. Returns a new array
 * (does not mutate). Endpoints (first and last) are never moved.
 */
function applyDiceKeepout(points: THREE.Vector3[]): THREE.Vector3[] {
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p; // endpoints stay
    const r = Math.hypot(p.x, p.z);
    if (r >= DICE_KEEPOUT_RADIUS) return p; // already clear
    // Push outward in the XZ plane
    if (r < 0.001) {
      // Degenerate: point is at origin. Push in a sensible default
      // direction based on the next point (towards the snake's far end)
      return new THREE.Vector3(DICE_KEEPOUT_RADIUS, p.y, 0);
    }
    const scale = DICE_KEEPOUT_RADIUS / r;
    return new THREE.Vector3(p.x * scale, p.y, p.z * scale);
  });
}

/**
 * Post-process a TubeGeometry: any vertex whose XZ position is within
 * `minRadius` of the origin is pushed radially outward to `minRadius`.
 * The Y coordinate is preserved (snakes can still arc up over the
 * dice area, just not pass under it).
 *
 * The endpoints of the tube (vertices at u=0 and u=1 along the path)
 * are also clamped, but we do not move them past their tile.
 */
function clampTubeToKeepout(geo: THREE.TubeGeometry, minRadius: number): THREE.TubeGeometry {
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const r = Math.hypot(x, z);
    if (r < minRadius && r > 0.0001) {
      const scale = minRadius / r;
      positions.setX(i, x * scale);
      positions.setZ(i, z * scale);
    }
    // y is unchanged
    void y;
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export class Snake {
  readonly data: SnakeData;
  readonly group: THREE.Group;
  private spec: SnakeStyleSpec;
  private curve: THREE.CatmullRomCurve3;
  private tubeMaterial: THREE.MeshStandardMaterial;

  constructor(data: SnakeData) {
    this.data = data;
    this.spec = SNAKE_STYLES[data.name] ?? { style: 's-curve', color: 0xC41E3A, radius: 0.09, samples: 40 };
    this.group = new THREE.Group();
    this.group.name = `Snake-${data.name}`;

    const start = squareToWorld(data.from);
    const end = squareToWorld(data.to);

    // Build control points according to the style, then push them
    // out of the dice keep-out zone. The CatmullRomCurve3 can still
    // dip inward between control points, so we ALSO post-process the
    // final tube geometry to guarantee the mesh respects the keep-out.
    const rawPoints = this.buildControlPoints(start, end, this.spec);
    const controlPoints = applyDiceKeepout(rawPoints);
    this.curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);

    // Tube geometry from the curve
    let tubeGeo = new THREE.TubeGeometry(this.curve, this.spec.samples, this.spec.radius, 8, false);
    tubeGeo = clampTubeToKeepout(tubeGeo, DICE_KEEPOUT_RADIUS + this.spec.radius);
    this.tubeMaterial = new THREE.MeshStandardMaterial({
      color: this.spec.color,
      roughness: 0.45,
      metalness: 0.1
    });
    const tube = new THREE.Mesh(tubeGeo, this.tubeMaterial);
    tube.castShadow = true;
    this.group.add(tube);

    // Head — slightly larger sphere at the start, with eye dots
    const headGeo = new THREE.SphereGeometry(this.spec.radius * 1.6, 16, 16);
    const head = new THREE.Mesh(headGeo, this.tubeMaterial);
    head.position.copy(start);
    head.castShadow = true;
    this.group.add(head);

    // Tail — smaller, tapered
    const tailGeo = new THREE.SphereGeometry(this.spec.radius * 0.5, 12, 12);
    const tail = new THREE.Mesh(tailGeo, this.tubeMaterial);
    tail.position.copy(end);
    this.group.add(tail);

    // Eyes (two small dark dots) for snakes that face forward (all of them)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const eyeGeo = new THREE.SphereGeometry(this.spec.radius * 0.3, 8, 8);
    const eyeOffset = this.spec.radius * 1.2;
    // Eyes point along the tangent at the start
    const tangent = this.curve.getTangent(0).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.copy(start)
        .addScaledVector(side, s * eyeOffset)
        .addScaledVector(up, this.spec.radius * 0.5);
      this.group.add(eye);
    }
  }

  /**
   * Expose the curve so the Game can use it to animate a sliding pion
   * along the snake's path.
   */
  getPath(): THREE.Curve<THREE.Vector3> { return this.curve; }

  private buildControlPoints(start: THREE.Vector3, end: THREE.Vector3, spec: SnakeStyleSpec): THREE.Vector3[] {
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const perp = new THREE.Vector3(-dz / length, 0, dx / length);
    const up = new THREE.Vector3(0, 1, 0);

    // Lift baseline: snakes generally arc upward from the board surface.
    // The "peak" height scales with length so long snakes arch higher.
    const baseLift = 0.6 + length * 0.10;

    switch (spec.style) {
      case 's-curve': {
        // Two opposite perpendicular kicks for an S shape
        const mid = new THREE.Vector3()
          .copy(start).add(end).multiplyScalar(0.5)
          .addScaledVector(perp, length * 0.3)
          .addScaledVector(up, baseLift);
        const q1 = new THREE.Vector3()
          .copy(start).lerp(mid, 0.5)
          .addScaledVector(perp, -length * 0.15)
          .addScaledVector(up, baseLift * 0.4);
        const q3 = new THREE.Vector3()
          .copy(mid).lerp(end, 0.5)
          .addScaledVector(perp, length * 0.15)
          .addScaledVector(up, baseLift * 0.4);
        return [start.clone(), q1, mid, q3, end.clone()];
      }

      case 'coil': {
        // Single revolution: generate 8 points around a circle that
        // collapses onto the start->end line
        const loops = spec.loops ?? 1;
        const loopR = (spec.loopRadius ?? 0.5) * length * 0.3;
        const pts: THREE.Vector3[] = [start.clone()];
        const steps = 16;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const center = new THREE.Vector3().copy(start).lerp(end, t);
          const angle = t * Math.PI * 2 * loops;
          const offset = new THREE.Vector3()
            .addScaledVector(perp, Math.cos(angle) * loopR)
            .addScaledVector(up, Math.sin(angle) * loopR + baseLift * 0.4);
          pts.push(center.add(offset));
        }
        pts.push(end.clone());
        return pts;
      }

      case 'zigzag': {
        // 6 angular waypoints alternating side to side
        const pts: THREE.Vector3[] = [start.clone()];
        const segments = 6;
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const center = new THREE.Vector3().copy(start).lerp(end, t);
          const side = i % 2 === 0 ? 1 : -1;
          const kick = new THREE.Vector3()
            .addScaledVector(perp, side * length * 0.18)
            .addScaledVector(up, baseLift * (0.5 + Math.sin(t * Math.PI) * 0.5));
          pts.push(center.add(kick));
        }
        pts.push(end.clone());
        return pts;
      }

      case 'waves': {
        // Many small tight undulations (centipede)
        const pts: THREE.Vector3[] = [start.clone()];
        const segments = 14;
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          const center = new THREE.Vector3().copy(start).lerp(end, t);
          const side = i % 2 === 0 ? 1 : -1;
          const kick = new THREE.Vector3()
            .addScaledVector(perp, side * length * 0.08)
            .addScaledVector(up, baseLift * (0.3 + Math.sin(t * Math.PI) * 0.7));
          pts.push(center.add(kick));
        }
        pts.push(end.clone());
        return pts;
      }

      case 'loop': {
        // Big circular loop in the middle, then dive
        const loopR = (spec.loopRadius ?? 0.6) * length * 0.5;
        const loopCenter = new THREE.Vector3()
          .copy(start).lerp(end, 0.4)
          .addScaledVector(perp, loopR * 0.6)
          .addScaledVector(up, baseLift * 0.7);
        // Build 8 points around the loop
        const pts: THREE.Vector3[] = [start.clone()];
        pts.push(new THREE.Vector3().copy(start).lerp(loopCenter, 0.5).addScaledVector(up, baseLift * 0.5));
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          pts.push(new THREE.Vector3()
            .copy(loopCenter)
            .addScaledVector(perp, Math.cos(a) * loopR)
            .addScaledVector(up, Math.sin(a) * loopR));
        }
        pts.push(new THREE.Vector3().copy(loopCenter).lerp(end, 0.5).addScaledVector(up, baseLift * 0.3));
        pts.push(end.clone());
        return pts;
      }

      case 'spiral': {
        // Two stacked loops descending (Javanese dragon style)
        const loops = spec.loops ?? 1.5;
        const loopR = (spec.loopRadius ?? 0.5) * length * 0.35;
        const pts: THREE.Vector3[] = [start.clone()];
        const steps = 20;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const center = new THREE.Vector3().copy(start).lerp(end, t);
          const angle = t * Math.PI * 2 * loops;
          const descent = baseLift * (1.0 - t * 0.5);
          const offset = new THREE.Vector3()
            .addScaledVector(perp, Math.cos(angle) * loopR)
            .addScaledVector(up, Math.sin(angle) * loopR * 0.4 + descent);
          pts.push(center.add(offset));
        }
        pts.push(end.clone());
        return pts;
      }

      case 'arch': {
        // Gentle arch (lake serpent)
        const arch1 = new THREE.Vector3().copy(start).lerp(end, 0.3)
          .addScaledVector(perp, length * 0.1)
          .addScaledVector(up, baseLift);
        const arch2 = new THREE.Vector3().copy(start).lerp(end, 0.7)
          .addScaledVector(perp, -length * 0.1)
          .addScaledVector(up, baseLift * 0.7);
        return [start.clone(), arch1, arch2, end.clone()];
      }

      case 'scorpion': {
        // Straight for the first 70%, then a sharp hook up at the head
        const straightEnd = new THREE.Vector3().copy(start).lerp(end, 0.7)
          .addScaledVector(up, baseLift * 0.3);
        const hookUp = new THREE.Vector3().copy(straightEnd)
          .addScaledVector(up, baseLift * 1.5);
        const hookOver = new THREE.Vector3().copy(hookUp)
          .addScaledVector(perp, -length * 0.2)
          .addScaledVector(up, baseLift * 0.5);
        return [start.clone(), straightEnd, hookUp, hookOver, end.clone()];
      }

      case 'v-shape': {
        // Angular V dipping low in the middle (Komodo lizard spine)
        const mid = new THREE.Vector3().copy(start).lerp(end, 0.5)
          .addScaledVector(up, baseLift * 0.15); // low dip
        return [start.clone(), mid, end.clone()];
      }
    }
  }
}
