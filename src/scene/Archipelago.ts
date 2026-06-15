/**
 * Stylized 2.5D Indonesia archipelago. Five island blobs under the
 * board, each positioned roughly under the squares that belong to its
 * region, sized to be a stylized abstraction (not geographic accuracy).
 *
 * Each island is an extruded oval with a small inner "plateau" so it
 * looks like a 2.5D cartoon island. The ocean is a flat plane below
 * with a deep teal color.
 *
 * The archipelago is rendered BEFORE the tiles in scene-graph order
 * (i.e. lower in the z-buffer) so tiles sit on top.
 */
import * as THREE from 'three';
import { TILE_STEP, squareToColRow } from '../data/path';
import type { Region } from '../data/board';

interface IslandSpec {
  readonly region: Region;
  readonly label: string;
  /** World position of the island center (in board units). */
  readonly cx: number;
  readonly cz: number;
  /** Oval radii in x (length) and z (width). */
  readonly rx: number;
  readonly rz: number;
  /** Slight rotation around Y for organic feel. */
  readonly rotY: number;
  /** Earth color (sandy loam, varies per island). */
  readonly earth: number;
  /** Height of the raised part. */
  readonly lift: number;
}

const ISLANDS: ReadonlyArray<IslandSpec> = [
  // Sumatra: long thin island running NW-SE, squares 1-20 (lower-left to lower-mid)
  { region: 'sumatra',    label: 'Sumatra',    cx: -4.0, cz: -3.6, rx: 1.5, rz: 0.7, rotY: -Math.PI / 6, earth: 0x6B7A3A, lift: 0.08 },
  // Java: long thin E-W, squares 21-50 (bottom-center)
  { region: 'java',       label: 'Java',       cx: -1.0, cz: -3.4, rx: 2.6, rz: 0.55, rotY: 0,           earth: 0xA89270, lift: 0.08 },
  // Kalimantan: big roundish, squares 51-70 (mid-right)
  { region: 'kalimantan', label: 'Kalimantan', cx:  2.4, cz: -1.4, rx: 1.4, rz: 1.5, rotY: 0,           earth: 0x5A6B2A, lift: 0.08 },
  // Sulawesi: oddly shaped, but stylized as a tall thin oval, squares 71-85 (upper-right)
  { region: 'sulawesi',   label: 'Sulawesi',   cx:  2.5, cz:  1.6, rx: 0.6, rz: 1.4, rotY: Math.PI / 6,  earth: 0x4A5A2A, lift: 0.08 },
  // Papua: large wide, squares 86-100 (top)
  { region: 'papua',      label: 'Papua',      cx:  0.4, cz:  3.4, rx: 2.0, rz: 1.1, rotY: 0,           earth: 0x8B5A2B, lift: 0.08 }
];

/** Convert (col, row) to world (x, z) — same as path.ts but exposed here for islands. */
function colRowToWorld(col: number, row: number): { x: number; z: number } {
  return {
    x: (col - 4.5) * TILE_STEP,
    z: (row - 4.5) * TILE_STEP
  };
}

export class Archipelago {
  readonly group: THREE.Group;
  private islandMeshes: THREE.Mesh[] = [];
  private labelSprites: THREE.Sprite[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Archipelago';
    this.buildOcean();
    this.buildIslands();
    this.buildLabels();
  }

  private buildOcean(): void {
    // The ocean is one large plane with a deep teal color, extending well
    // beyond the board so the edges look like the horizon. Tiles sit
    // ABOVE this plane so it's mostly visible in the corners.
    const geo = new THREE.PlaneGeometry(20, 20);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a3d6a,
      roughness: 0.7,
      metalness: 0.0
    });
    const ocean = new THREE.Mesh(geo, mat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.y = -0.10;
    ocean.receiveShadow = true;
    this.group.add(ocean);

    // Subtle wave-ring decoration: a few concentric rings near the board
    // (purely decorative, no physics)
    for (let r = 0; r < 3; r++) {
      const ringGeo = new THREE.RingGeometry(3.2 + r * 0.5, 3.25 + r * 0.5, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x1A73C4,
        transparent: true,
        opacity: 0.25 - r * 0.07,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.08;
      this.group.add(ring);
    }
  }

  private buildIslands(): void {
    for (const spec of ISLANDS) {
      // Each island = an oval (scaled cylinder) + a smaller raised plateau
      // to give 2.5D depth
      const group = new THREE.Group();
      group.name = `Island-${spec.label}`;

      const earthMat = new THREE.MeshStandardMaterial({
        color: spec.earth,
        roughness: 0.85,
        metalness: 0.0
      });
      // Use a low-poly cylinder with many sides to approximate an oval
      const sides = 32;
      const baseGeo = new THREE.CylinderGeometry(1, 1, spec.lift, sides);
      // Squash X and Z to make it oval
      baseGeo.scale(spec.rx, 1, spec.rz);
      const base = new THREE.Mesh(baseGeo, earthMat);
      base.position.set(spec.cx, spec.lift / 2 - 0.05, spec.cz);
      base.rotation.y = spec.rotY;
      base.receiveShadow = true;
      base.castShadow = true;
      this.islandMeshes.push(base);
      group.add(base);

      // A smaller "plateau" on top for visual interest
      const plateauGeo = new THREE.CylinderGeometry(0.7, 0.85, spec.lift * 0.4, sides);
      plateauGeo.scale(spec.rx, 1, spec.rz);
      const plateau = new THREE.Mesh(plateauGeo, new THREE.MeshStandardMaterial({
        color: this.lighten(spec.earth, 0.15),
        roughness: 0.7,
        metalness: 0.0
      }));
      plateau.position.set(spec.cx, spec.lift - 0.05 + spec.lift * 0.2, spec.cz);
      plateau.rotation.y = spec.rotY;
      plateau.castShadow = true;
      group.add(plateau);

      this.group.add(group);
    }
  }

  private buildLabels(): void {
    // Subtle floating labels for each island, off to the side so they
    // don't overlap with the tiles. Sprite-based for size invariance.
    for (const spec of ISLANDS) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      // Background pill
      ctx.fillStyle = 'rgba(27, 42, 74, 0.85)';
      ctx.beginPath();
      const r = 24;
      ctx.moveTo(r, 4);
      ctx.lineTo(256 - r, 4);
      ctx.quadraticCurveTo(256, 4, 256, 32);
      ctx.quadraticCurveTo(256, 60, 256 - r, 60);
      ctx.lineTo(r, 60);
      ctx.quadraticCurveTo(0, 60, 0, 32);
      ctx.quadraticCurveTo(0, 4, r, 4);
      ctx.closePath();
      ctx.fill();
      // Border
      ctx.strokeStyle = '#D4A843';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Text
      ctx.fillStyle = '#F5F0E8';
      ctx.font = 'bold 28px Baloo Bhaijaan 2, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(spec.label, 128, 32);

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      // Place label to the side of the island, out of tile grid
      const offsetX = spec.region === 'java' ? 0 : (spec.region === 'kalimantan' || spec.region === 'sulawesi' ? 1.0 : -1.0);
      sprite.position.set(spec.cx + offsetX, 0.6, spec.cz);
      sprite.scale.set(1.2, 0.30, 1);
      this.labelSprites.push(sprite);
      this.group.add(sprite);
    }
  }

  /** Helper: lighten a color by a fraction (0..1) toward white. */
  private lighten(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + Math.floor(255 * amount));
    const g = Math.min(255, ((color >> 8) & 0xff) + Math.floor(255 * amount));
    const b = Math.min(255, (color & 0xff) + Math.floor(255 * amount));
    return (r << 16) | (g << 8) | b;
  }

  /** Returns the world Y position for a given square (so the pion sits ON the island, not under). */
  getSquareY(sq: number): number {
    // Find which island this square is on
    const { col, row } = squareToColRow(sq);
    const { x, z } = colRowToWorld(col, row);
    // Default ocean Y
    let y = 0.0;
    for (const spec of ISLANDS) {
      // Distance from square to island center, accounting for rotation
      const dx = x - spec.cx;
      const dz = z - spec.cz;
      // Rotate into island-local coords
      const cosA = Math.cos(-spec.rotY);
      const sinA = Math.sin(-spec.rotY);
      const lx = dx * cosA - dz * sinA;
      const lz = dx * sinA + dz * cosA;
      // Check if inside oval
      const inside = (lx * lx) / (spec.rx * spec.rx) + (lz * lz) / (spec.rz * spec.rz) < 1.0;
      if (inside) {
        y = spec.lift; // sit on top of the island
        break;
      }
    }
    return y;
  }
}
