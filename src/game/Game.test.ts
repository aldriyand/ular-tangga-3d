/**
 * Tests for the Game class. Covers initialization, simulateMatch, win
 * condition, and dice-locking state machine.
 *
 * Tests that need to inspect the win state or trigger specific square
 * landings use simulateMatch (which auto-resolves bots) and check
 * invariants rather than reaching into private methods.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from './Game';
import { GameState } from './GameState';

describe('Game', () => {
  let game: Game;

  beforeEach(() => {
    game = new Game({ seed: 12345, useCrypto: false });
    game.newMatch('medium', 'parang');
  });

  it('initializes with 4 players at square 0', () => {
    const players = game.getPlayers();
    expect(players).toHaveLength(4);
    for (const p of players) {
      expect(p.square).toBe(0);
    }
  });

  it('starts in MENU state (waiting for human to roll)', () => {
    expect(game.getState()).toBe(GameState.MENU);
    expect(game.getActivePlayerIndex()).toBe(0);
  });

  it('reports the player costume', () => {
    expect(game.getPlayerCostume()).toBe('parang');
  });

  it('simulateMatch completes with a valid winner', () => {
    const result = game.simulateMatch(3000);
    expect(result.winnerIndex).toBeGreaterThanOrEqual(0);
    expect(result.winnerIndex).toBeLessThan(4);
    expect(result.turns).toBeGreaterThan(0);
    expect(game.getState()).toBe(GameState.GAME_OVER);
  });

  it('simulateMatch produces different winners across runs (with different seeds)', () => {
    // 20 games with different seeds, see how winners distribute
    const winners: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < 20; i++) {
      const g = new Game({ seed: 1000 + i, useCrypto: false });
      g.newMatch('medium', 'parang');
      const r = g.simulateMatch(3000);
      winners[r.winnerIndex] = (winners[r.winnerIndex] ?? 0) + 1;
    }
    // At least 2 of the 4 players should have won at least once.
    // (If only one winner shows up, the bot AI is too dominant.)
    const nonZeroWinners = Object.values(winners).filter((c) => c > 0).length;
    expect(nonZeroWinners).toBeGreaterThanOrEqual(2);
  });

  it('uses deterministic seed for the same game', () => {
    const g1 = new Game({ seed: 777, useCrypto: false });
    g1.newMatch('medium', 'parang');
    g1.simulateMatch(3000);
    const state1 = g1.getState();
    const turnCount1 = g1.getPlayers().reduce((sum, p) => sum + p.square, 0);

    const g2 = new Game({ seed: 777, useCrypto: false });
    g2.newMatch('medium', 'parang');
    g2.simulateMatch(3000);
    const state2 = g2.getState();
    const turnCount2 = g2.getPlayers().reduce((sum, p) => sum + p.square, 0);

    expect(state1).toBe(state2);
    expect(turnCount1).toBe(turnCount2);
  });

  it('human roll transitions to a non-MENU state', () => {
    game.humanRoll();
    const state = game.getState();
    // After a human rolls, the state can be THROWING (dice animating),
    // MOVING (pion animating), or SET_ASIDE (waiting to lock/commit)
    expect([
      GameState.THROWING,
      GameState.MOVING,
      GameState.SET_ASIDE
    ]).toContain(state);
  });

  it('simulateMatch ends exactly at square 100 for the winner', () => {
    const result = game.simulateMatch(3000);
    // After simulateMatch, the winner is the player at index result.winnerIndex
    const players = game.getPlayers();
    // simulateMatch uses applyCommittedSumImmediate which respects the
    // overshoot walk-back rule; the winner must be at 100.
    expect(players[result.winnerIndex]!.square).toBe(100);
  });

  it('newMatch with different costume updates the costume', () => {
    game.newMatch('hard', 'ulos');
    expect(game.getPlayerCostume()).toBe('ulos');
    expect(game.getDifficulty()).toBe('hard');
  });

  it('newMatch resets all players to square 0', () => {
    // Run a match to completion
    game.simulateMatch(3000);
    expect(game.getState()).toBe(GameState.GAME_OVER);
    // Start a new match
    game.newMatch('easy', 'kawung');
    for (const p of game.getPlayers()) {
      expect(p.square).toBe(0);
    }
    expect(game.getState()).toBe(GameState.MENU);
  });
});
