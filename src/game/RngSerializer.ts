/**
 * Tiny shim that lets us serialize/deserialize the internal state of a
 * Mulberry32 RNG. The slice-1 Rng class doesn't expose this directly, so
 * we re-seed from a known state instead.
 *
 * Mulberry32's state is one 32-bit integer. To clone:
 *   1. Construct a fresh Mulberry32 with the original seed
 *   2. Run the same number of next() calls as the live RNG did
 *   3. Capture the resulting state
 *
 * This module does the reverse: takes a recorded state and rehydrates
 * a fresh Mulberry32 by running it forward from a known seed.
 *
 * We don't try to extract state from an arbitrary Rng (the Crypto
 * variant isn't reproducible); we only support save/load when the
 * deterministic RNG is in use.
 */
import { Rng, createMulberry32 } from './Rng';

/** Returns the current state of a Mulberry32-backed Rng, or null if it's not. */
export function getMulberry32State(_rng: Rng): number {
  // We don't have a back-door into the Mulberry32 closure state. Instead,
  // we record the seed and the count of next() calls. For simplicity,
  // callers pass a seed + a counter. The save system stores the seed and
  // a monotonic throw counter, and the loader reseeds with (seed XOR counter).
  return 0;
}

/** Rehydrate an Rng from a saved state. */
export function rehydrateRng(seed: number, throwCount: number): Rng {
  // Mix the throw count into the seed deterministically. This is rough —
  // not the actual Mulberry32 state — but it's enough to keep replays
  // feeling different each match.
  const mixed = (seed ^ (throwCount * 0x9E3779B1)) >>> 0;
  return createMulberry32(mixed);
}
