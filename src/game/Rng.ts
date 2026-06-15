/**
 * Deterministic seedable RNG (Mulberry32).
 * - Replaceable with crypto.getRandomValues() in production by swapping the impl
 *   behind the Rng interface.
 * - Same seed → same sequence → reproducible bug reports and tests.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Fair 1d6. */
  d6(): number;
  /** Pick one element of a non-empty array. */
  pick<T>(arr: readonly T[]): T;
}

export function createMulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number {
      if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    d6(): number {
      return this.int(1, 6);
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('Rng.pick: empty array');
      return arr[this.int(0, arr.length - 1)]!;
    }
  };
}

/**
 * Crypto-backed RNG for production. Falls back to Mulberry32 if crypto is unavailable.
 */
export function createCryptoRng(): Rng {
  const hasCrypto = typeof crypto !== 'undefined' && 'getRandomValues' in crypto;
  if (!hasCrypto) {
    return createMulberry32((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  }
  return {
    next(): number {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0]! / 4294967296;
    },
    int(min: number, max: number): number {
      if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    d6(): number {
      return this.int(1, 6);
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('Rng.pick: empty array');
      return arr[this.int(0, arr.length - 1)]!;
    }
  };
}
