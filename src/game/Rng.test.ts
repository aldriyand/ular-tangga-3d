/**
 * Tests for the Mulberry32 RNG: deterministic, in [0,1), uniform.
 */
import { describe, it, expect } from 'vitest';
import { createMulberry32 } from './Rng';

describe('Rng', () => {
  it('produces deterministic values for the same seed', () => {
    const a = createMulberry32(42);
    const b = createMulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('produces different values for different seeds', () => {
    const a = createMulberry32(1);
    const b = createMulberry32(2);
    let sameCount = 0;
    for (let i = 0; i < 100; i++) {
      if (a.next() === b.next()) sameCount++;
    }
    // Two different seeds should rarely produce the same value back-to-back
    expect(sameCount).toBeLessThan(5);
  });

  it('next() returns values in [0, 1)', () => {
    const r = createMulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('d6() returns integers in [1, 6]', () => {
    const r = createMulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.d6();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('d6() has a roughly uniform distribution over many rolls', () => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const r = createMulberry32(11);
    const n = 6000;
    for (let i = 0; i < n; i++) {
      const v = r.d6();
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // Each face should be within ~3.3% of n/6 (binomial standard deviation)
    const expected = n / 6;
    for (let i = 1; i <= 6; i++) {
      const c = counts[i]!;
      expect(c).toBeGreaterThan(expected - 200);
      expect(c).toBeLessThan(expected + 200);
    }
  });
});
