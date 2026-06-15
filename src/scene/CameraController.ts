/**
 * Camera mode controller. Three modes:
 *  - ISOMETRIC:  fixed overview of the whole board
 *  - FOLLOW:     track the active pion (slight zoom + smooth follow)
 *  - WIN_SWEEP:  cinematic orbit when the game ends
 *
 * The controller updates the THREE.Camera each frame. It does NOT own the
 * render loop; SceneRoot calls update() from its loop.
 */
import * as THREE from 'three';
import { clamp, TAU, easeInOutCubic } from '../utils/math';
import { makeTween, Tween } from '../utils/animation';
import { BOARD_SIZE } from '../data/path';

export type CameraMode = 'isometric' | 'follow' | 'win-sweep';

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  private mode: CameraMode = 'isometric';
  private followTarget = new THREE.Vector3(0, 0, 0);
  private currentTransition: Tween | null = null;
  private sweepTween: Tween | null = null;
  private sweepStart = 0;
  private sweepRadius = 0;
  private sweepHeight = 0;
  private sweepCenter = new THREE.Vector3(0, 0, 0);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.camera.position.set(0, BOARD_SIZE * 1.6, BOARD_SIZE * 1.6);
    this.camera.lookAt(0, 0, 0);
  }

  setFollowTarget(x: number, y: number, z: number): void {
    this.followTarget.set(x, y, z);
  }

  /** Snap to a new position/look-at with an animated transition. */
  private transitionTo(toPos: THREE.Vector3, toLookAt: THREE.Vector3, durationMs: number, onDone?: () => void): void {
    const fromPos = this.camera.position.clone();
    const fromLookAt = this.currentLookAt();
    let baseTween: Tween;
    baseTween = makeTween(
      { durationMs, ease: easeInOutCubic },
      (t) => {
        this.camera.position.lerpVectors(fromPos, toPos, t);
        const la = new THREE.Vector3().lerpVectors(fromLookAt, toLookAt, t);
        this.camera.lookAt(la);
      }
    );
    if (onDone) {
      const realStep = baseTween.step.bind(baseTween);
      let finished = false;
      baseTween.step = (dt: number): boolean => {
        const running = realStep(dt);
        if (!running && !finished) { finished = true; onDone(); }
        return running;
      };
    }
    this.currentTransition = baseTween;
  }

  private currentLookAt(): THREE.Vector3 {
    // Recompute from the camera's current orientation by re-deriving its forward.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return this.camera.position.clone().add(dir.multiplyScalar(20));
  }

  setMode(mode: CameraMode, winLookAt?: THREE.Vector3): void {
    this.mode = mode;
    this.currentTransition = null;
    this.sweepTween = null;

    if (mode === 'isometric') {
      this.transitionTo(
        new THREE.Vector3(0, BOARD_SIZE * 1.6, BOARD_SIZE * 1.6),
        new THREE.Vector3(0, 0, 0),
        600
      );
    } else if (mode === 'follow') {
      // Handled in update() every frame.
    } else if (mode === 'win-sweep') {
      const center = winLookAt ?? new THREE.Vector3(0, 0, 0);
      this.sweepCenter.copy(center);
      this.sweepStart = Math.atan2(this.camera.position.z - center.z, this.camera.position.x - center.x);
      this.sweepRadius = clamp(this.camera.position.distanceTo(center) * 0.9, 8, 16);
      this.sweepHeight = this.camera.position.y;
      // Linear easing so the orbit is visible from t=0; the orbital
      // motion itself is the easing
      this.sweepTween = makeTween({ durationMs: 6000, ease: (t) => t }, () => { /* angles updated in update() */ });
    }
  }

  update(dtMs: number): void {
    if (this.currentTransition) {
      this.currentTransition.step(dtMs);
      return;
    }

    if (this.mode === 'follow') {
      // Slight delay/lerp toward the follow target
      const desired = new THREE.Vector3(
        this.followTarget.x,
        this.followTarget.y + BOARD_SIZE * 0.6,
        this.followTarget.z + BOARD_SIZE * 0.6
      );
      this.camera.position.lerp(desired, clamp(dtMs / 200, 0, 1));
      this.camera.lookAt(this.followTarget);
    } else if (this.mode === 'win-sweep' && this.sweepTween) {
      this.sweepTween.step(dtMs);
      const t = this.sweepTween.t; // 0..1
      const angle = this.sweepStart + TAU * 0.6 * t;
      this.camera.position.set(
        this.sweepCenter.x + Math.cos(angle) * this.sweepRadius,
        this.sweepHeight * (1.2 - 0.7 * t),
        this.sweepCenter.z + Math.sin(angle) * this.sweepRadius
      );
      this.camera.lookAt(this.sweepCenter);
    }
  }
}
