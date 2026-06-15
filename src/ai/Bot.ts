/**
 * Bot AI. Base class declares the interface; Easy/Medium/Hard implement
 * different strategies.
 *
 * Slice 2 mechanics: bots participate in the dice-locking flow. They
 * get the same throw/animation cycle as humans, but the `decideLocks`
 * hook tells the game which dice to set aside after each throw.
 *
 * Slice 1 tradeoffs that slice 2 fixes:
 *   - All bots used to be honest "just roll" — they had the same RNG outcome,
 *     they were distinguishable only by thinking time. With dice-locking,
 *     Medium and Hard make observable different decisions.
 */
import type { Rng } from '../game/Rng';
import { getSnakeAt, getLadderAt } from '../data/board';
import type { DiceState } from '../components/Dice';

export interface BotView {
  readonly myIndex: number;
  readonly mySquare: number;
  readonly opponents: ReadonlyArray<{ index: number; square: number }>;
  readonly rng: Rng;
}

export abstract class Bot {
  abstract name: string;
  abstract readonly difficulty: 'easy' | 'medium' | 'hard';

  /** How long to "think" between throws (and before the first throw). */
  thinkDelayMs(): number {
    return 700;
  }

  /**
   * Decide which dice to set aside after a throw. Called for the human's
   * dice too (in single-player the UI handles it; for bots this is the
   * one decision per throw).
   *
   * Slice-2: returning more dice set aside = bot wants to commit.
   * The default below (Easy) sets aside nothing and re-rolls everything
   * (worse strategy but valid).
   */
  decideLocks(_view: BotView, _state: DiceState): [boolean, boolean] {
    return [false, false];
  }
}

/** Easy: rolls once, commits. Same as a human who doesn't know to set aside. */
export class EasyBot extends Bot {
  name: string;
  readonly difficulty = 'easy' as const;
  constructor(suffix: string) { super(); this.name = `Bot ${suffix}`; }
  override thinkDelayMs(): number { return 500; }
  override decideLocks(view: BotView, state: DiceState): [boolean, boolean] {
    void view; void state;
    return [true, true]; // commit immediately
  }
}

/**
 * Medium: 1 re-roll. Prefers to set aside dice that, combined with the
 * current value, would land on a ladder or avoid a snake.
 *
 * Honest logic:
 *   - If the current sum lands on a ladder → set aside BOTH (commit).
 *   - If the current sum lands on a snake → set aside NOTHING (re-roll).
 *   - If sum > 6 (high chance of overshooting 100 from mid-board) →
 *     set aside the smaller die to try to keep the total low.
 *   - Otherwise, set aside the die that helps us most (one re-roll).
 */
export class MediumBot extends Bot {
  name: string;
  readonly difficulty = 'medium' as const;
  constructor(suffix: string) { super(); this.name = `Bot ${suffix}`; }
  override thinkDelayMs(): number { return 900; }
  override decideLocks(view: BotView, state: DiceState): [boolean, boolean] {
    if (state.throwsUsed >= 2) return [true, true]; // last throw: commit

    const currentSum = state.currentSum;
    const targetSquare = view.mySquare + currentSum;

    // If sum lands on a ladder, commit
    if (getLadderAt(targetSquare)) return [true, true];

    // If sum lands on a snake, re-roll
    if (getSnakeAt(targetSquare)) return [false, false];

    // If sum > 6, set aside the smaller die (try to drop to ≤6 next throw)
    if (currentSum > 6) {
      const a = state.values[0] ?? 0;
      const b = state.values[1] ?? 0;
      if (a <= b) return [true, false];
      return [false, true];
    }

    // Default: keep one die, re-roll the other
    const a = state.values[0] ?? 0;
    const b = state.values[1] ?? 0;
    if (a >= 4) return [true, false];
    if (b >= 4) return [false, true];
    // Both low (e.g. 1, 2) — set aside the higher one, re-roll the lower
    if (a > b) return [true, false];
    if (b > a) return [false, true];
    return [false, false];
  }
}

/**
 * Hard: 2 re-rolls + position-aware + looks ahead at next 1-2 squares.
 * Same as Medium but also:
 *   - Considers opponents: if an opponent is close behind, prefer higher
 *     sums to outpace them.
 *   - At sq 99, ALWAYS re-roll (try for 1, accept 1-6 because anything
 *     other than exact 1 overshoots and walks back).
 */
export class HardBot extends Bot {
  name: string;
  readonly difficulty = 'hard' as const;
  constructor(suffix: string) { super(); this.name = `Bot ${suffix}`; }
  override thinkDelayMs(): number { return 1200; }

  override decideLocks(view: BotView, state: DiceState): [boolean, boolean] {
    if (state.throwsUsed >= 3) return [true, true];

    const currentSum = state.currentSum;
    const targetSquare = view.mySquare + currentSum;

    // 99 is special: only "1" wins. 2-6 all overshoot. We can't lock a 1
    // (it's a re-roll outcome), so we set aside NOTHING and pray. If we
    // already rolled a 1, lock both.
    if (view.mySquare === 99) {
      if (currentSum === 1) return [true, true];
      return [false, false];
    }

    // Ladder? Commit.
    if (getLadderAt(targetSquare)) return [true, true];

    // Snake? Re-roll both, see if next throw is better.
    if (getSnakeAt(targetSquare)) return [false, false];

    // High sum? Look at the high-value die; if it alone is a useful
    // anchor (>=4), keep it and re-roll the small one.
    const a = state.values[0] ?? 0;
    const b = state.values[1] ?? 0;
    if (currentSum > 6) {
      if (a <= b) return [true, false];
      return [false, true];
    }

    // Low sum, neither die is a clear winner: re-roll both for max variance
    // (Hard's "high-risk high-reward" signature).
    if (a + b <= 4) return [false, false];

    // Otherwise: keep the higher one (≥4), re-roll the lower.
    if (a >= 4 && a >= b) return [true, false];
    if (b >= 4 && b > a) return [false, true];

    // Fallback
    return [false, false];
  }
}

/** Pick a bot class for a given difficulty and index. */
export function createBot(difficulty: 'easy' | 'medium' | 'hard', index: number): Bot {
  const nameMap = ['Alpha', 'Beta', 'Gamma'];
  const suffix = nameMap[index - 1] ?? `Bot${index}`;
  switch (difficulty) {
    case 'easy':   return new EasyBot(suffix);
    case 'medium': return new MediumBot(suffix);
    case 'hard':   return new HardBot(suffix);
  }
}
