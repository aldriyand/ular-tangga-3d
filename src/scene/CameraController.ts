/**
 * Camera mode controller. Four modes:
 *  - ISOMETRIC:   fixed overview of the whole board
 *  - FOLLOW:      track the active pion (slight zoom + smooth follow)
 *  - WIN_SWEEP:   cinematic orbit when the game ends
 *  - FREE_ORBIT:  user-controlled orbit (drag to rotate, wheel/pinch to zoom)
 *
 * The controller updates the THREE.Camera each frame. It does NOT own the
 * render loop; SceneRoot calls update() from its loop.
 *
 * FREE_ORBIT input handling: `attachInput(canvas)` wires pointer events
 * directly on the canvas (no dependency on main.ts). Call `detachInput()`
 * to clean up.
 */
import * as THREE from 'three';
import { clamp, TAU, easeInOutCubic } from '../utils/math';
import { makeTween, Tween } from '../utils/animation';
import { BOARD_SIZE } from '../data/path';

export type CameraMode = 'isometric' | 'follow' | 'win-sweep' | 'free-orbit';

const ORBIT_MIN_POLAR = 0.15;        // radians from straight-up (don't look from below)
const ORBIT_MAX_POLAR = Math.PI * 0.42; // radians from straight-up (don't look from below board)
const ORBIT_MIN_RADIUS = 4;
const ORBIT_MAX_RADIUS = 30;
const ORBIT_DRAG_SENSITIVITY = 0.0085; // radians per pixel of drag
const ORBIT_ZOOM_SENSITIVITY = 0.012;   // world units per wheel-delta unit
const ORBIT_TOUCH_SENSITIVITY = 0.005;
const ORBIT_TOUCH_PINCH_SENSITIVITY = 0.03;

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

  // Free-orbit state (spherical coords around `orbitTarget`)
  private orbitAzimuth = Math.PI * 0.25;  // around Y axis, radians
  private orbitPolar = Math.PI * 0.30;     // from +Y axis, radians
  private orbitRadius = BOARD_SIZE * 1.6;
  private orbitTarget = new THREE.Vector3(0, 0, 0);

  // Input wiring (for free-orbit)
  private attachedCanvas: HTMLCanvasElement | null = null;
  private pointerDown = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  // For touch pinch-to-zoom
  private activeTouches: Map<number, { x: number; y: number }> = new Map();
  private lastPinchDistance: number | null = null;
  // Bound event handlers (need to be removable on detach)
  private readonly onPointerDown = (e: PointerEvent): void => this.handlePointerDown(e);
  private readonly onPointerMove = (e: PointerEvent): void => this.handlePointerMove(e);
  private readonly onPointerUp = (e: PointerEvent): void => this.handlePointerUp(e);
  private readonly onWheel = (e: WheelEvent): void => this.handleWheel(e);
  private readonly onTouchStart = (e: TouchEvent): void => this.handleTouchStart(e);
  private readonly onTouchMove = (e: TouchEvent): void => this.handleTouchMove(e);
  private readonly onTouchEnd = (e: TouchEvent): void => this.handleTouchEnd(e);
  private readonly onContextMenu = (e: Event): void => e.preventDefault();

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
      this.sweepTween = makeTween({ durationMs: 6000, ease: (t) => t }, () => { /* angles updated in update() */ });
    } else if (mode === 'free-orbit') {
      // Snapshot the camera's current state into spherical coords around the
      // board center. Don't snap — let the user continue from where they were.
      this.snapshotOrbitFromCamera();
    }
  }

  getMode(): CameraMode { return this.mode; }

  /**
   * Convert the camera's current world position into spherical coordinates
   * (azimuth, polar, radius) around the board center. Called when entering
   * free-orbit so the user keeps their current view angle.
   */
  private snapshotOrbitFromCamera(): void {
    this.orbitTarget.set(0, 0, 0);
    const dx = this.camera.position.x - this.orbitTarget.x;
    const dy = this.camera.position.y - this.orbitTarget.y;
    const dz = this.camera.position.z - this.orbitTarget.z;
    this.orbitRadius = Math.sqrt(dx * dx + dy * dy + dz * dz);
    this.orbitPolar = Math.acos(clamp(dy / Math.max(0.001, this.orbitRadius), -1, 1));
    this.orbitAzimuth = Math.atan2(dz, dx);
  }

  /**
   * Apply the current orbit state to the camera. Called every frame in
   * free-orbit mode.
   */
  private applyOrbitToCamera(): void {
    const sinPolar = Math.sin(this.orbitPolar);
    this.camera.position.set(
      this.orbitTarget.x + this.orbitRadius * sinPolar * Math.cos(this.orbitAzimuth),
      this.orbitTarget.y + this.orbitRadius * Math.cos(this.orbitPolar),
      this.orbitTarget.z + this.orbitRadius * sinPolar * Math.sin(this.orbitAzimuth)
    );
    this.camera.lookAt(this.orbitTarget);
  }

  // -- Public orbit controls (called by input handlers below) --

  /** Rotate by a delta in pixels. Positive dx rotates right, positive dy rotates up. */
  rotateByPixelDelta(dx: number, dy: number, sensitivity = ORBIT_DRAG_SENSITIVITY): void {
    this.orbitAzimuth -= dx * sensitivity;
    // Add (not subtract) dy so dragging the mouse "up" tilts the camera "up" (poles move away)
    this.orbitPolar = clamp(this.orbitPolar - dy * sensitivity, ORBIT_MIN_POLAR, ORBIT_MAX_POLAR);
  }

  /** Zoom by a delta in arbitrary units. Positive zooms in (smaller radius). */
  zoomByDelta(delta: number, sensitivity = ORBIT_ZOOM_SENSITIVITY): void {
    this.orbitRadius = clamp(this.orbitRadius + delta * sensitivity, ORBIT_MIN_RADIUS, ORBIT_MAX_RADIUS);
  }

  // -- Input wiring --

  /**
   * Attach pointer/wheel/touch listeners to the given canvas. When the
   * camera is in free-orbit mode, these manipulate the orbit state.
   * In other modes, they're no-ops.
   *
   * Listeners are attached in passive=false mode where needed to allow
   * preventDefault (to suppress browser pinch-zoom on the page).
   */
  attachInput(canvas: HTMLCanvasElement): void {
    if (this.attachedCanvas === canvas) return;
    this.detachInput(); // safety
    this.attachedCanvas = canvas;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd);
    canvas.addEventListener('touchcancel', this.onTouchEnd);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  detachInput(): void {
    const c = this.attachedCanvas;
    if (!c) return;
    c.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('touchstart', this.onTouchStart);
    c.removeEventListener('touchmove', this.onTouchMove);
    c.removeEventListener('touchend', this.onTouchEnd);
    c.removeEventListener('touchcancel', this.onTouchEnd);
    c.removeEventListener('contextmenu', this.onContextMenu);
    this.attachedCanvas = null;
  }

  private isActive(): boolean {
    // Only react to input when the user is in free-orbit mode
    return this.mode === 'free-orbit';
  }

  private handlePointerDown(e: PointerEvent): void {
    if (!this.isActive()) return;
    // Only react to primary button (left click) or touch (pointerType === 'touch')
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointerDown = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    // Capture the pointer so we keep getting move events even if the
    // user drags off the canvas
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isActive() || !this.pointerDown) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.rotateByPixelDelta(dx, dy);
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.isActive()) return;
    e.preventDefault();
    this.zoomByDelta(e.deltaY);
  }

  private handleTouchStart(e: TouchEvent): void {
    if (!this.isActive()) return;
    e.preventDefault();
    this.activeTouches.clear();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]!;
      this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (this.activeTouches.size === 2) {
      this.lastPinchDistance = this.computePinchDistance();
    } else {
      this.lastPinchDistance = null;
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.isActive()) return;
    e.preventDefault();
    // Update tracked touches
    const currentIds = new Set<number>();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]!;
      currentIds.add(t.identifier);
      const prev = this.activeTouches.get(t.identifier);
      this.activeTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      if (prev && this.activeTouches.size === 1) {
        // Single-finger drag
        const dx = t.clientX - prev.x;
        const dy = t.clientY - prev.y;
        this.rotateByPixelDelta(dx, dy, ORBIT_TOUCH_SENSITIVITY);
      }
    }
    // Prune ended touches
    for (const id of Array.from(this.activeTouches.keys())) {
      if (!currentIds.has(id)) this.activeTouches.delete(id);
    }
    // Two-finger pinch → zoom
    if (this.activeTouches.size === 2) {
      const d = this.computePinchDistance();
      if (d !== null && this.lastPinchDistance !== null) {
        const delta = this.lastPinchDistance - d; // pinch out (d grows) → negative delta → zoom in
        this.zoomByDelta(delta, ORBIT_TOUCH_PINCH_SENSITIVITY);
      }
      this.lastPinchDistance = d;
    } else {
      this.lastPinchDistance = null;
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (!this.isActive()) return;
    this.activeTouches.clear();
    this.lastPinchDistance = null;
    // Don't preventDefault here; let the touchend propagate normally
    void e;
  }

  private computePinchDistance(): number | null {
    const arr = Array.from(this.activeTouches.values());
    if (arr.length < 2) return null;
    const [a, b] = arr;
    if (!a || !b) return null;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
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
    } else if (this.mode === 'free-orbit') {
      this.applyOrbitToCamera();
    }
  }
}
