/**
 * Tests for the board data: snakes, ladders, regions.
 */
import { describe, it, expect } from 'vitest';
import { getSnakeAt, getLadderAt, getRegionForSquare, SNAKES, LADDERS } from './board';

describe('Board data', () => {
  it('all snakes go from a higher to a lower square', () => {
    for (const s of SNAKES) {
      expect(s.from).toBeGreaterThan(s.to);
      expect(s.from).toBeLessThanOrEqual(100);
      expect(s.to).toBeGreaterThanOrEqual(1);
    }
  });

  it('all ladders go from a lower to a higher square', () => {
    for (const l of LADDERS) {
      expect(l.from).toBeLessThan(l.to);
      expect(l.from).toBeGreaterThanOrEqual(1);
      expect(l.to).toBeLessThanOrEqual(100);
    }
  });

  it('no snake or ladder shares a destination/start with another', () => {
    const allFroms = new Set<number>();
    const allTos = new Set<number>();
    for (const s of SNAKES) {
      expect(allFroms.has(s.from)).toBe(false);
      expect(allTos.has(s.to)).toBe(false);
      allFroms.add(s.from);
      allTos.add(s.to);
    }
    for (const l of LADDERS) {
      expect(allFroms.has(l.from)).toBe(false);
      expect(allTos.has(l.to)).toBe(false);
      allFroms.add(l.from);
      allTos.add(l.to);
    }
  });

  it('getSnakeAt returns the right snake for a known head', () => {
    const s = getSnakeAt(98);
    expect(s).toBeDefined();
    expect(s!.name).toBeTruthy();
  });

  it('getSnakeAt returns undefined for a non-snake square', () => {
    expect(getSnakeAt(50)).toBeUndefined();
  });

  it('getLadderAt returns the right ladder for a known foot', () => {
    const l = getLadderAt(4);
    expect(l).toBeDefined();
    expect(l!.to).toBeGreaterThan(l!.from);
  });

  it('all 5 regions are represented in the 100 squares', () => {
    const regions = new Set<string>();
    for (let sq = 1; sq <= 100; sq++) {
      regions.add(getRegionForSquare(sq));
    }
    expect(regions.size).toBe(5);
  });
});
