/**
 * Finite state machine for the game.
 *
 * Transitions are explicit (see allowedTransitions). Any state change that
 * isn't in the table throws — this is a safety net against typos and
 * regressions. The Game class owns the current state; UI/scene/components
 * subscribe via the EventBus to react.
 */
export enum GameState {
  /** Initial state. Show menu, waiting for player to start. */
  MENU = 'MENU',
  /** Dice is animating. Block player input. */
  THROWING = 'THROWING',
  /** Between throws; player can lock dice and re-roll. */
  SET_ASIDE = 'SET_ASIDE',
  /** Pion is animating from current to target square. */
  MOVING = 'MOVING',
  /** Pion is sliding down a snake. */
  SNAKE = 'SNAKE',
  /** Pion is climbing a ladder. */
  LADDER = 'LADDER',
  /** Pion overshot 100; walking back the excess. */
  WALK_BACK = 'WALK_BACK',
  /** Bot is "thinking" between throws. */
  BOT_THINK = 'BOT_THINK',
  /** Game over — someone reached 100. */
  GAME_OVER = 'GAME_OVER'
}

const allowedTransitions: Record<GameState, ReadonlyArray<GameState>> = {
  [GameState.MENU]:       [GameState.THROWING, GameState.BOT_THINK, GameState.GAME_OVER],
  [GameState.THROWING]:    [GameState.SET_ASIDE, GameState.MOVING, GameState.WALK_BACK, GameState.GAME_OVER],
  [GameState.SET_ASIDE]:   [GameState.THROWING, GameState.MOVING, GameState.WALK_BACK, GameState.MENU, GameState.BOT_THINK, GameState.GAME_OVER],
  [GameState.MOVING]:      [GameState.SNAKE, GameState.LADDER, GameState.BOT_THINK, GameState.MENU, GameState.GAME_OVER],
  [GameState.SNAKE]:       [GameState.BOT_THINK, GameState.MENU, GameState.GAME_OVER],
  [GameState.LADDER]:      [GameState.BOT_THINK, GameState.MENU, GameState.GAME_OVER],
  [GameState.WALK_BACK]:   [GameState.BOT_THINK, GameState.MENU, GameState.GAME_OVER],
  [GameState.BOT_THINK]:   [GameState.THROWING, GameState.MENU, GameState.GAME_OVER],
  [GameState.GAME_OVER]:   [GameState.MENU]
};

export function canTransition(from: GameState, to: GameState): boolean {
  return allowedTransitions[from].includes(to);
}

export function assertTransition(from: GameState, to: GameState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal state transition: ${from} → ${to}`);
  }
}
