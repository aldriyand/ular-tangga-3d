/**
 * Save/load game state to localStorage.
 *
 * Schema v1 (slice 2):
 *   {
 *     v: 1,
 *     seed: number,            // RNG seed for replay
 *     rngState: number,        // Mulberry32 internal state
 *     activePlayerIndex: number,
 *     players: Array<{
 *       index: number, name: string, isHuman: boolean,
 *       botDifficulty: 'easy' | 'medium' | 'hard' | null,
 *       square: number
 *     }>
 *   }
 *
 * Note: we don't save animation state or current FSM mid-transition.
 * Save is only valid in MENU / GAME_OVER states. Calling save in
 * ROLLING / MOVING returns null (the caller should wait).
 */
import type { Rng } from './Rng';
import { getMulberry32State } from './RngSerializer';

export const SAVE_KEY = 'ular-tangga-3d:save:v1';

export interface SaveState {
  v: 1;
  seed: number;
  rngState: number;
  activePlayerIndex: number;
  difficulty: 'easy' | 'medium' | 'hard';
  /** Player's chosen batik costume. */
  playerCostume: string;
  players: Array<{
    index: number;
    name: string;
    isHuman: boolean;
    botDifficulty: 'easy' | 'medium' | 'hard' | null;
    square: number;
  }>;
}

export function saveExists(): boolean {
  try { return localStorage.getItem(SAVE_KEY) !== null; }
  catch { return false; }
}

export function readSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveState;
    if (parsed.v !== 1) return null;
    if (!Array.isArray(parsed.players)) return null;
    if (parsed.players.length < 2 || parsed.players.length > 4) return null;
    // playerCostume is optional in v1 saves; default to parang
    if (typeof (parsed as { playerCostume?: unknown }).playerCostume !== 'string') {
      parsed.playerCostume = 'parang';
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSave(s: SaveState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

/** Helper: build a SaveState from live game state. */
export function buildSave(
  seed: number,
  rng: Rng,
  activePlayerIndex: number,
  difficulty: 'easy' | 'medium' | 'hard',
  players: SaveState['players'],
  playerCostume: string
): SaveState {
  return {
    v: 1,
    seed,
    rngState: getMulberry32State(rng),
    activePlayerIndex,
    difficulty,
    playerCostume,
    players
  };
}
