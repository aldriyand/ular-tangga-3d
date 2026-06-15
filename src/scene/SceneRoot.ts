/**
 * Scene root: owns the THREE renderer, the scene graph root, lights, and the
 * render loop. Other components (BoardGeometry, Dice, Pion, …) add meshes
 * under `scene`.
 *
 * The render loop is start()ed once and runs forever. update(dtMs) is called
 * before each render so per-frame logic (camera, tweens, dice animation) can run.
 */
import * as THREE from 'three';
import { CameraController } from './CameraController';

export class SceneRoot {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly cameraController: CameraController;
  private rafHandle: number | null = null;
  private lastTimeMs = 0;
  private updaters: Array<(dtMs: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = null; // CSS gradient on the canvas shows through

    this.camera = new THREE.PerspectiveCamera(
      40, // narrower FOV for a flatter isometric feel
      canvas.clientWidth / Math.max(1, canvas.clientHeight),
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.cameraController = new CameraController(this.camera);

    this.setupLights();
    this.setupResize(canvas);
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xfff0d4, 0.55);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff2c5, 0.9);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    this.scene.add(sun);
  }

  private setupResize(canvas: HTMLCanvasElement): void {
    const onResize = (): void => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    // Run once at construction in case the initial size is wrong
    onResize();
  }

  /** Register a per-frame updater. Returns an unsubscribe function. */
  onUpdate(fn: (dtMs: number) => void): () => void {
    this.updaters.push(fn);
    return () => {
      const idx = this.updaters.indexOf(fn);
      if (idx >= 0) this.updaters.splice(idx, 1);
    };
  }

  start(): void {
    if (this.rafHandle !== null) return;
    this.lastTimeMs = performance.now();
    const loop = (now: number): void => {
      const dtMs = Math.min(64, now - this.lastTimeMs); // cap dt to avoid huge jumps
      this.lastTimeMs = now;

      for (const fn of this.updaters) {
        try { fn(dtMs); } catch (err) { console.error('[SceneRoot] updater threw:', err); }
      }
      this.cameraController.update(dtMs);
      this.renderer.render(this.scene, this.camera);
      this.rafHandle = requestAnimationFrame(loop);
    };
    this.rafHandle = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }
}
