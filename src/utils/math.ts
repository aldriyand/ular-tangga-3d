/**
 * Tiny math helpers used by the rest of the game.
 * Kept dependency-free so they're tree-shake-friendly.
 */
export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Standard ease-in-out cubic. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Standard ease-out cubic (snappy start, soft landing). */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Standard ease-in cubic. */
export function easeInCubic(t: number): number {
  return t * t * t;
}
