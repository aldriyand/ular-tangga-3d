/**
 * Path: maps a 1..100 square to a world (x, y, z) coordinate on the board.
 *
 * Layout: classic S-pattern 10x10 grid. Bottom row (1-10) left-to-right,
 * then 11-20 right-to-left, then 21-30 left-to-right, etc. The "tail" (1)
 * is at the bottom-left of the grid from the player's POV; square 100 is
 * at the top-left. We'll orient the camera so the player sees square 1
 * at the bottom-left.
 *
 *   z (depth, increases away from camera)
 *   ^
 *   |
 *   |  91 92 93 ... 100  <- row 10 (top, z = +9)
 *   |  90 89 88 ...  81  <- row  9 (z = +8)
 *   |  ...
 *   |   1  2  3 ...  10  <- row  1 (bottom, z = 0)
 *   +---------------------> x
 *
 * Tiles are TILE_SIZE wide. Origin is the center of the grid.
 */
import * as THREE from 'three';
import type { Square } from './board';

export const TILE_SIZE = 1.0;
export const TILE_STEP = TILE_SIZE + 0.04; // gap baked in; see TILE_GAP was 0.04
export const TILE_GAP = 0.04;
export const TILE_Y = 0.05;     // tiles sit slightly above the island base
export const BOARD_SIZE = 10 * TILE_STEP;

/**
 * Pure function: square → (col, row) on the 10x10 grid.
 * Row 0 is the bottom (squares 1-10), row 9 is the top (squares 91-100).
 * Col 0 is the left, col 9 is the right.
 * On odd rows (counting from 0), columns go right-to-left.
 */
export function squareToColRow(sq: Square): { col: number; row: number } {
  if (sq < 1 || sq > 100) throw new Error(`squareToColRow: square ${sq} out of range`);
  const idx = sq - 1;             // 0..99
  const row = Math.floor(idx / 10); // 0..9, 0 = bottom
  const colInRow = idx % 10;        // 0..9 within the row
  const col = (row % 2 === 0) ? colInRow : (9 - colInRow);
  return { col, row };
}

/**
 * Square → world XYZ, centered at origin.
 * x increases to the right, z increases away from camera, y is height.
 * Returns a real THREE.Vector3 so callers can pass it straight to APIs.
 */
export function squareToWorld(sq: Square): THREE.Vector3 {
  const { col, row } = squareToColRow(sq);
  const x = (col - 4.5) * TILE_STEP;
  const z = (row - 4.5) * TILE_STEP;
  return new THREE.Vector3(x, TILE_Y, z);
}

/**
 * Color palette per region, used to tint tiles in slice 1.
 * Real batik-pattern textures will replace this in slice 2.
 */
export const REGION_TILE_COLOR: Record<string, number> = {
  sumatra:    0x2d5a27,  // island green
  java:       0xd4a843,  // songket gold
  kalimantan: 0x3a7d32,  // island green light
  sulawesi:   0x1b2a4a,  // batik blue
  papua:      0xc41e3a   // ulos red
};
