/**
 * Minimal typed pub/sub. Used for Game → UI, Game → Scene, Scene → Game, etc.
 * No async, no wildcards, no namespaces. Just type-safe event names.
 */
export type GameEvent =
  | { type: 'state-changed'; from: string; to: string }
  | { type: 'turn-changed'; playerIndex: number; playerName: string }
  | { type: 'dice-rolled'; playerIndex: number; value: number }
  | { type: 'dice-state-changed'; values: [number | null, number | null]; locked: boolean[]; throwsUsed: number }
  | { type: 'pion-moved'; playerIndex: number; from: number; to: number }
  | { type: 'snake-triggered'; playerIndex: number; from: number; to: number; name: string }
  | { type: 'ladder-triggered'; playerIndex: number; from: number; to: number; name: string }
  | { type: 'walk-back'; playerIndex: number; overshoot: number; final: number }
  | { type: 'game-over'; winnerIndex: number; winnerName: string }
  | { type: 'toast'; text: string; durationMs: number }
  | { type: 'menu-shown' }
  | { type: 'menu-hidden' }
  | { type: 'match-started'; difficulty: 'easy' | 'medium' | 'hard' }
  | { type: 'trivia-show'; playerIndex: number; monumentName: string }
  | { type: 'trivia-answer'; playerIndex: number; correct: boolean }
  | { type: 'trivia-hide' };

type Listener<T> = (event: T) => void;

export class EventBus {
  private listeners: { [K in GameEvent['type']]?: Array<(event: Extract<GameEvent, { type: K }>) => void> } = {};

  on<K extends GameEvent['type']>(type: K, listener: Listener<Extract<GameEvent, { type: K }>>): () => void {
    const arr = (this.listeners[type] ??= []) as Array<Listener<Extract<GameEvent, { type: K }>>>;
    arr.push(listener);
    return () => {
      const idx = arr.indexOf(listener);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  emit(event: GameEvent): void {
    const arr = this.listeners[event.type] as Array<Listener<typeof event>> | undefined;
    if (!arr) return;
    // Copy so listeners that unsubscribe mid-emit don't break iteration
    for (const listener of [...arr]) {
      try {
        listener(event);
      } catch (err) {
        // Don't let one bad listener kill the chain
        console.error(`[EventBus] listener for "${event.type}" threw:`, err);
      }
    }
  }

  clear(): void {
    this.listeners = {};
  }
}
