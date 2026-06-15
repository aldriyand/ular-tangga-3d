/**
 * Tests for the trivia module: 7 monuments × 2-3 questions each.
 */
import { describe, it, expect } from 'vitest';
import { TRIVIA, getTrivia, getTriviaForLadder } from './Trivia';

describe('Trivia', () => {
  it('has questions for all 7 monuments', () => {
    const expected = [
      'Candi Borobudur',
      'Candi Prambanan',
      'Istana Maimun',
      'Benteng Rotterdam',
      'Monas',
      'Candi Sewu',
      'Taman Nasional Komodo'
    ];
    for (const monument of expected) {
      expect(TRIVIA[monument]).toBeDefined();
      expect(TRIVIA[monument]!.length).toBeGreaterThan(0);
    }
  });

  it('every question has 3 choices and a valid correctIndex', () => {
    for (const monument of Object.keys(TRIVIA)) {
      for (const q of TRIVIA[monument]!) {
        expect(q.choices).toHaveLength(3);
        expect([0, 1, 2]).toContain(q.correctIndex);
        expect(q.q.length).toBeGreaterThan(10);
        expect(q.fact.length).toBeGreaterThan(10);
      }
    }
  });

  it('getTrivia returns a valid question for a known monument', () => {
    const q = getTrivia('Candi Borobudur');
    expect(q).not.toBeNull();
    expect(q!.choices).toHaveLength(3);
  });

  it('getTrivia returns null for an unknown monument', () => {
    const q = getTrivia('This Monument Does Not Exist');
    expect(q).toBeNull();
  });

  it('getTriviaForLadder works with a Ladder data shape', () => {
    // Ladder has fields: from, to, name, region, location (string)
    const fakeLadder = {
      from: 4, to: 45, name: 'Candi Borobudur',
      region: 'java' as const, location: 'Central Java'
    };
    const q = getTriviaForLadder(fakeLadder);
    expect(q).not.toBeNull();
  });
});
