/**
 * 3D board geometry. Slice 3:
 *  - Tiles are smaller and sit ABOVE the archipelago islands (Y varies
 *    per island via Archipelago.getSquareY)
 *  - The flat blue base plane is gone; Archipelago.ts handles the ocean
 *  - Snake and ladder visuals are now stylized 3D geometry
 */
import * as THREE from 'three';
import { TILE_SIZE, TILE_Y, TILE_STEP, REGION_TILE_COLOR, squareToColRow } from '../data/path';
import { getRegionForSquare, getSnakeAt, getLadderAt } from '../data/board';
import { Snake } from '../components/Snake';
import { Ladder } from '../components/Ladder';
import { Archipelago } from './Archipelago';
import { REGION_BATIK, makeBatikTexture } from './BatikTextures';

export class BoardGeometry {
  readonly group: THREE.Group;
  readonly tileMap: Map<number, THREE.Mesh> = new Map();
  readonly snakes: Snake[] = [];
  readonly ladders: Ladder[] = [];
  readonly archipelago: Archipelago;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Board';

    this.archipelago = new Archipelago();
    this.group.add(this.archipelago.group);

    this.buildTiles();
    this.buildSnakesAndLadders();
  }

  private buildTiles(): void {
    // Per-region batik textures (one per region, shared across all
    // tiles in that region — no need to create 100 textures)
    const batikTextures = new Map<string, THREE.CanvasTexture>();
    for (const [region, spec] of Object.entries(REGION_BATIK)) {
      batikTextures.set(region, makeBatikTexture(spec.pattern, {
        fg: spec.fg,
        bg: spec.bg,
        accent: spec.accent,
        size: 128
      }));
    }

    // Tiles are smaller so the islands around them are visible
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE, 0.06, TILE_SIZE);
    for (let sq = 1; sq <= 100; sq++) {
      const region = getRegionForSquare(sq);
      const regionColor = REGION_TILE_COLOR[region] ?? 0x888888;
      const batikTex = batikTextures.get(region);
      // 6 materials for the 6 box faces. Order: +x, -x, +y, -y, +z, -z.
      // We give the top face (+y) the batik texture, the others solid
      // colors so the tile has visible depth.
      const sideMat = new THREE.MeshStandardMaterial({
        color: regionColor,
        roughness: 0.6,
        metalness: 0.08
      });
      const topMat = new THREE.MeshStandardMaterial({
        map: batikTex ?? null,
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.05
      });
      // Use a 6-element array of materials for the box
      const matArray = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
      const mesh = new THREE.Mesh(tileGeo, matArray);
      const { col, row } = squareToColRow(sq);
      // Lift each tile to the island's height (so they sit on the islands,
      // not on the ocean)
      const islandY = this.archipelago.getSquareY(sq);
      mesh.position.set(
        (col - 4.5) * TILE_STEP,
        islandY + TILE_Y,
        (row - 4.5) * TILE_STEP
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData['square'] = sq;
      this.group.add(mesh);
      this.tileMap.set(sq, mesh);

      // Number label — drawn with a slightly larger font and a translucent
      // backing so it stays readable over the batik
      this.addNumberLabel(sq, mesh.position, regionColor, islandY);
    }
  }

  private addNumberLabel(sq: number, pos: THREE.Vector3, baseColor: number, islandY: number): void {
    // Larger canvas + larger backing + larger font so the number stays
    // readable over the batik tile texture and snake-tube shadows.
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const isLight = (baseColor & 0xff) + ((baseColor >> 8) & 0xff) + ((baseColor >> 16) & 0xff) > 0x180;
    // Larger translucent backing with a subtle outline for contrast
    ctx.fillStyle = isLight ? 'rgba(245, 240, 232, 0.85)' : 'rgba(27, 42, 74, 0.85)';
    ctx.beginPath();
    ctx.arc(48, 48, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isLight ? '#1B2A4A' : '#F5F0E8';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = isLight ? '#1B2A4A' : '#F5F0E8';
    ctx.font = 'bold 36px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(sq), 48, 51);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    // Bigger plane so the larger backing is fully shown
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE * 0.95, TILE_SIZE * 0.95), mat);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.set(pos.x, islandY + 0.11, pos.z);
    this.group.add(labelMesh);
  }

  private buildSnakesAndLadders(): void {
    for (let sq = 1; sq <= 100; sq++) {
      const s = getSnakeAt(sq);
      if (s) {
        const snake = new Snake(s);
        this.group.add(snake.group);
        this.snakes.push(snake);
      }
      const l = getLadderAt(sq);
      if (l) {
        const ladder = new Ladder(l);
        this.group.add(ladder.group);
        this.ladders.push(ladder);
      }
    }
  }

  /** Returns the world position of a tile's top center. */
  getTileWorldPosition(sq: number): THREE.Vector3 {
    const mesh = this.tileMap.get(sq);
    if (!mesh) throw new Error(`getTileWorldPosition: no tile for square ${sq}`);
    return new THREE.Vector3(mesh.position.x, mesh.position.y + 0.03, mesh.position.z);
  }

  /** Look up a Snake by its starting square. */
  getSnakeAt(sq: number): Snake | undefined {
    return this.snakes.find(s => s.data.from === sq);
  }

  /** Look up a Ladder by its starting square. */
  getLadderAt(sq: number): Ladder | undefined {
    return this.ladders.find(l => l.data.from === sq);
  }
}
