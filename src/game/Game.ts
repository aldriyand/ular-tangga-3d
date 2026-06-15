/**
 * Game: the orchestrator. Slice 2 adds:
 *   - 2d6 with Farkle-style set-aside (3 throws max per turn)
 *   - Save/load to localStorage (resume match)
 *   - Menu gate (game doesn't auto-start on load; player picks difficulty)
 *   - A11y: emits turn-changed as aria-live updates
 *
 * FSM (extended):
 *   MENU          - waiting for player to start a new match
 *   THROWING      - dice animation in flight
 *   SET_ASIDE     - between throws; player can lock dice and re-roll
 *   MOVING        - pion animating
 *   SNAKE / LADDER / WALK_BACK
 *   BOT_THINK     - bot is "thinking" between throws (and before first)
 *   GAME_OVER
 */
import * as THREE from 'three';
import { EventBus } from './EventBus';
import { GameState, assertTransition } from './GameState';
import { Rng, createMulberry32, createCryptoRng } from './Rng';
import { Bot, createBot, BotView } from '../ai/Bot';
import { getSnakeAt, getLadderAt } from '../data/board';
import { squareToWorld } from '../data/path';
import type { Pion } from '../components/Pion';
import type { Snake as SnakeVisual } from '../components/Snake';
import type { Ladder as LadderVisual } from '../components/Ladder';
import { DiceState, newDiceState, DieIndex } from '../components/Dice';
import { SaveState, readSave, writeSave, clearSave, saveExists, buildSave } from './SaveLoad';

export interface PlayerConfig {
  index: number;
  name: string;
  isHuman: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
}

interface InternalPlayer {
  index: number;
  name: string;
  isHuman: boolean;
  botDifficulty: 'easy' | 'medium' | 'hard' | null;
  bot?: Bot;
  square: number;
}

const PLAYER_NAMES: Record<number, string> = {
  0: 'Player',
  1: 'Bot Ulos',
  2: 'Bot Batik',
  3: 'Bot Songket'
};

export class Game {
  readonly bus = new EventBus();
  private state: GameState = GameState.MENU;
  private players: InternalPlayer[] = [];
  private activePlayerIndex = 0;
  private pions: Pion[] = [];
  private getTileWorldPos: ((sq: number) => THREE.Vector3) | null = null;
  private dice: { roll: (v: [number, number], onDone: () => void) => void; snapToValue: (d: DieIndex, v: number) => void; update: (dt: number) => void; value: [number, number] } | null = null;
  /** Camera controller for cinematic effects (win-sweep, etc). */
  private cameraController: { setMode: (mode: 'isometric' | 'follow' | 'win-sweep', winLookAt?: THREE.Vector3) => void } | null = null;
  /** Resolver functions for snake/ladder visual objects, set by main.ts. */
  private getSnakeVisual: ((sq: number) => SnakeVisual | undefined) | null = null;
  private getLadderVisual: ((sq: number) => LadderVisual | undefined) | null = null;
  private rng: Rng;
  private diceState: DiceState = newDiceState();
  private difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  /** Player's chosen batik costume (parang/ulos/kawung/poleng/ukir). */
  private playerCostume: string = 'parang';
  private seed: number;
  private throwCount = 0; // monotonic counter for save/load reproducibility

  constructor(opts: { seed?: number; useCrypto?: boolean } = {}) {
    this.seed = opts.seed ?? 0xC0FFEE;
    this.rng = opts.useCrypto ? createCryptoRng() : createMulberry32(this.seed);
  }

  bindScene(deps: {
    pions: Pion[];
    getTileWorldPos: (sq: number) => THREE.Vector3;
    dice: { roll: (v: [number, number], onDone: () => void) => void; snapToValue: (d: DieIndex, v: number) => void; update: (dt: number) => void; value: [number, number] };
    getSnakeVisual?: (sq: number) => SnakeVisual | undefined;
    getLadderVisual?: (sq: number) => LadderVisual | undefined;
    cameraController?: { setMode: (mode: 'isometric' | 'follow' | 'win-sweep', winLookAt?: THREE.Vector3) => void };
  }): void {
    this.pions = deps.pions;
    this.getTileWorldPos = deps.getTileWorldPos;
    this.dice = deps.dice;
    this.getSnakeVisual = deps.getSnakeVisual ?? null;
    this.getLadderVisual = deps.getLadderVisual ?? null;
    this.cameraController = deps.cameraController ?? null;
  }

  getState(): GameState { return this.state; }
  getPlayers(): ReadonlyArray<InternalPlayer> { return this.players; }
  getActivePlayerIndex(): number { return this.activePlayerIndex; }
  getDiceState(): DiceState { return this.diceState; }
  getDifficulty(): 'easy' | 'medium' | 'hard' { return this.difficulty; }
  getPlayerCostume(): string { return this.playerCostume; }

  /** Build a fresh player list for the current difficulty. */
  private buildPlayers(difficulty: 'easy' | 'medium' | 'hard'): InternalPlayer[] {
    const list: InternalPlayer[] = [
      { index: 0, name: PLAYER_NAMES[0]!, isHuman: true, botDifficulty: null, square: 0 }
    ];
    for (let i = 1; i <= 3; i++) {
      // Default mix: 1 hard, 1 medium, 1 easy; with chosen difficulty, scale accordingly
      const botDiff = difficulty;
      const list2: InternalPlayer = {
        index: i,
        name: PLAYER_NAMES[i]!,
        isHuman: false,
        botDifficulty: botDiff,
        square: 0
      };
      list2.bot = createBot(botDiff, i);
      list.push(list2);
    }
    return list;
  }

  /** Build players from a saved game. */
  private restorePlayers(saved: SaveState): InternalPlayer[] {
    return saved.players.map((p) => {
      const out: InternalPlayer = {
        index: p.index,
        name: p.name,
        isHuman: p.isHuman,
        botDifficulty: p.botDifficulty,
        square: p.square
      };
      if (!p.isHuman && p.botDifficulty) {
        out.bot = createBot(p.botDifficulty, p.index);
      }
      return out;
    });
  }

  /** Begin a new match with the given difficulty. */
  newMatch(difficulty: 'easy' | 'medium' | 'hard', playerCostume: string = 'parang'): void {
    this.difficulty = difficulty;
    this.playerCostume = playerCostume;
    this.seed = (Date.now() & 0xFFFFFFFF) >>> 0;
    this.rng = createMulberry32(this.seed);
    this.players = this.buildPlayers(difficulty);
    this.throwCount = 0;
    this.resetMatch();
  }

  /** Resume a previously saved match. */
  resumeMatch(): boolean {
    const saved = readSave();
    if (!saved) return false;
    this.seed = saved.seed;
    this.rng = createMulberry32(this.seed);
    // Advance RNG to roughly where it was by re-throwing N times.
    for (let i = 0; i < saved.rngState; i++) this.rng.d6();
    this.players = this.restorePlayers(saved);
    this.activePlayerIndex = saved.activePlayerIndex;
    this.difficulty = saved.difficulty;
    this.playerCostume = saved.playerCostume;
    this.resetMatch();
    return true;
  }

  private resetMatch(): void {
    this.activePlayerIndex = 0;
    this.diceState = newDiceState();
    this.players.forEach((p, i) => {
      p.square = 0;
      this.pions[i]?.snapToSquare(0, this.getTileWorldPos!);
    });
    this.bus.emit({ type: 'turn-changed', playerIndex: 0, playerName: this.players[0]!.name });
    this.transitionTo(GameState.MENU);
    this.startTurnForActive();
  }

  /** Called when a human clicks the dice button. */
  humanRoll(): void {
    if (this.state !== GameState.MENU && this.state !== GameState.SET_ASIDE) return;
    if (this.players[this.activePlayerIndex]!.isHuman === false) return;
    this.rollForActive();
  }

  /** Human locks/unlocks a die. */
  humanToggleLock(die: DieIndex): void {
    if (this.state !== GameState.SET_ASIDE) return;
    if (this.players[this.activePlayerIndex]!.isHuman === false) return;
    // Lock toggle
    const wasLocked = this.diceState.locked[die];
    // You can only lock dice that have a value (have been rolled)
    if (this.diceState.values[die] === null) return;
    // You can't unlock the last throw's dice (they're committed)
    if (wasLocked && this.diceState.isFinal) return;
    this.diceState.locked[die] = !wasLocked;
    this.bus.emit({
      type: 'dice-state-changed',
      values: [this.diceState.values[0], this.diceState.values[1]],
      locked: [...this.diceState.locked],
      throwsUsed: this.diceState.throwsUsed
    });
  }

  /** Human commits the current sum (skip remaining throws). */
  humanCommit(): void {
    if (this.state !== GameState.SET_ASIDE && this.state !== GameState.MENU) return;
    if (this.players[this.activePlayerIndex]!.isHuman === false) return;
    if (this.diceState.throwsUsed === 0) return;
    // Force isFinal
    this.diceState.locked = [true, true];
    this.applyCommittedSum(this.diceState.currentSum);
  }

  // --- internal ---

  private startTurnForActive(): void {
    const p = this.players[this.activePlayerIndex]!;
    this.bus.emit({ type: 'turn-changed', playerIndex: p.index, playerName: p.name });

    if (!p.isHuman && p.bot) {
      this.transitionTo(GameState.BOT_THINK);
      this.diceState = newDiceState();
      this.scheduleBotThrow(p);
    } else {
      // Human's turn: stay in MENU / SET_ASIDE
      this.diceState = newDiceState();
      this.transitionTo(GameState.MENU);
      this.bus.emit({
        type: 'dice-state-changed',
        values: [null, null],
        locked: [false, false],
        throwsUsed: 0
      });
    }
  }

  private scheduleBotThrow(p: InternalPlayer): void {
    const bot = p.bot!;
    const view: BotView = {
      myIndex: p.index,
      mySquare: p.square,
      opponents: this.players.filter(o => o.index !== p.index).map(o => ({ index: o.index, square: o.square })),
      rng: this.rng
    };
    const delay = bot.thinkDelayMs();
    window.setTimeout(() => {
      if (this.state !== GameState.BOT_THINK) return;
      if (this.players[this.activePlayerIndex] !== p) return;
      this.executeThrow();
      // After throw animation, schedule the lock decision
      window.setTimeout(() => {
        if (this.state !== GameState.SET_ASIDE) return;
        const locks = bot.decideLocks(view, this.diceState);
        this.applyLocks(locks, view, p);
      }, 700);
    }, delay);
  }

  private rollForActive(): void {
    this.executeThrow();
    // If human, transition to SET_ASIDE; if bot, the schedule handles it.
    if (this.players[this.activePlayerIndex]!.isHuman) {
      this.transitionTo(GameState.SET_ASIDE);
    }
  }

  private executeThrow(): void {
    const d1 = this.rng.d6();
    const d2 = this.rng.d6();
    this.throwCount++;
    // Re-roll dice that aren't locked
    const a = this.diceState.locked[0] ? (this.diceState.values[0] ?? d1) : d1;
    const b = this.diceState.locked[1] ? (this.diceState.values[1] ?? d2) : d2;
    this.diceState.values = [a, b];
    this.diceState.throwsUsed += 1;
    this.transitionTo(GameState.THROWING);
    if (this.dice) {
      // Snap locked dice to their value, animate the rest
      if (this.diceState.locked[0]) this.dice.snapToValue(0, a);
      if (this.diceState.locked[1]) this.dice.snapToValue(1, b);
      this.dice.roll([a, b], () => this.onThrowAnimationDone());
    } else {
      this.onThrowAnimationDone();
    }
  }

  private onThrowAnimationDone(): void {
    const p = this.players[this.activePlayerIndex]!;
    this.bus.emit({
      type: 'dice-state-changed',
      values: [this.diceState.values[0], this.diceState.values[1]],
      locked: [...this.diceState.locked],
      throwsUsed: this.diceState.throwsUsed
    });

    if (!p.isHuman) {
      // Bot path: transition through to SET_ASIDE so the chained lock
      // decision timer (scheduled in applyLocks) fires correctly.
      this.transitionTo(GameState.SET_ASIDE);
      // Schedule the bot's lock decision after a brief pause (matches
      // the time a human would take to click a die)
      const view: BotView = {
        myIndex: p.index,
        mySquare: p.square,
        opponents: this.players.filter(o => o.index !== p.index).map(o => ({ index: o.index, square: o.square })),
        rng: this.rng
      };
      window.setTimeout(() => {
        if (this.state !== GameState.SET_ASIDE) return;
        if (this.players[this.activePlayerIndex] !== p) return;
        const locks = p.bot!.decideLocks(view, this.diceState);
        this.applyLocks(locks, view, p);
      }, 400);
      return;
    }

    // Human: go to SET_ASIDE
    this.transitionTo(GameState.SET_ASIDE);
  }

  private applyLocks(locks: [boolean, boolean], view: BotView, p: InternalPlayer): void {
    this.diceState.locked = [locks[0], locks[1]];
    this.bus.emit({
      type: 'dice-state-changed',
      values: [this.diceState.values[0], this.diceState.values[1]],
      locked: [...this.diceState.locked],
      throwsUsed: this.diceState.throwsUsed
    });

    if (this.diceState.isFinal) {
      // Commit
      this.applyCommittedSum(this.diceState.currentSum);
      return;
    }

    // Schedule next throw
    window.setTimeout(() => {
      if (this.state !== GameState.SET_ASIDE) return;
      if (this.players[this.activePlayerIndex] !== p) return;
      // Recompute view (positions may have changed if a snake/ladder
      // hit on a previous turn, but for a single throw cycle they don't).
      this.executeThrow();
      window.setTimeout(() => {
        if (this.state !== GameState.SET_ASIDE) return;
        const newLocks = p.bot!.decideLocks(view, this.diceState);
        this.applyLocks(newLocks, view, p);
      }, 700);
    }, p.bot!.thinkDelayMs());
  }

  private applyCommittedSum(sum: number): void {
    const p = this.players[this.activePlayerIndex]!;
    const start = p.square;
    let target = start + sum;

    // Auto-save the game state before resolving (so a crash mid-animation
    // doesn't lose progress)
    this.persistSave();

    if (target > 100) {
      const overshoot = target - 100;
      target = 100 - overshoot;
      this.transitionTo(GameState.MOVING);
      this.animatePion(p.index, start, 100, () => {
        this.bus.emit({ type: 'walk-back', playerIndex: p.index, overshoot, final: target });
        this.transitionTo(GameState.WALK_BACK);
        this.animatePion(p.index, 100, target, () => this.afterMove(p, target));
      });
      return;
    }

    this.transitionTo(GameState.MOVING);
    this.animatePion(p.index, start, target, () => this.afterMove(p, target));
  }

  private afterMove(p: InternalPlayer, landed: number): void {
    p.square = landed;

    if (landed === 100) {
      this.triggerGameOver(p);
      return;
    }

    const snake = getSnakeAt(landed);
    if (snake) {
      this.bus.emit({ type: 'snake-triggered', playerIndex: p.index, from: landed, to: snake.to, name: snake.name });
      this.transitionTo(GameState.SNAKE);
      // Try to use the snake's curve for the slide; fall back to straight-line
      const visual = this.getSnakeVisual?.(landed);
      const onSlideDone = (): void => {
        p.square = snake.to;
        if (snake.to === 100) {
          this.triggerGameOver(p);
        } else {
          this.advanceTurn();
        }
      };
      if (visual) {
        this.animatePionAlongCurve(
          p.index, visual.getPath(), landed, snake.to, 1400, onSlideDone
        );
      } else {
        this.animatePion(p.index, landed, snake.to, onSlideDone);
      }
      return;
    }

    const ladder = getLadderAt(landed);
    if (ladder) {
      this.bus.emit({ type: 'ladder-triggered', playerIndex: p.index, from: landed, to: ladder.to, name: ladder.name });
      this.transitionTo(GameState.LADDER);
      // Try to use the ladder's climb path; fall back to straight-line
      const visual = this.getLadderVisual?.(landed);
      const onClimbDone = (): void => {
        p.square = ladder.to;
        if (ladder.to === 100) {
          this.triggerGameOver(p);
        } else {
          this.advanceTurn();
        }
      };
      if (visual) {
        // Extra y-bob for a "climbing" feel (4 hops along the climb)
        this.animatePionAlongCurve(
          p.index, visual.getPath(), landed, ladder.to, 1400,
          onClimbDone,
          (t) => Math.abs(Math.sin(t * Math.PI * 4)) * 0.12
        );
      } else {
        this.animatePion(p.index, landed, ladder.to, onClimbDone);
      }
      return;
    }

    this.advanceTurn();
  }

  /** Trigger the game-over sequence: emit event, kick off win-sweep camera, clear save. */
  private triggerGameOver(p: InternalPlayer): void {
    this.bus.emit({ type: 'game-over', winnerIndex: p.index, winnerName: p.name });
    this.transitionTo(GameState.GAME_OVER);
    clearSave();
    // Start the win-sweep camera around the winner's final position
    if (this.cameraController) {
      const winnerPion = this.pions[p.index];
      const winnerPos = winnerPion?.mesh?.position ?? new THREE.Vector3(0, 0, 0);
      this.cameraController.setMode('win-sweep', winnerPos.clone());
    }
  }

  private advanceTurn(): void {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    this.persistSave();
    this.startTurnForActive();
  }

  private animatePion(playerIndex: number, fromSq: number, toSq: number, onDone: () => void): void {
    const pion = this.pions[playerIndex];
    if (!pion || !this.getTileWorldPos) { onDone(); return; }
    pion.moveTo(toSq, (sq) => {
      if (sq === 0) {
        const p = this.getTileWorldPos!(1);
        return new THREE.Vector3(p.x, pion['baseHeight'] as number, p.z + 0.6);
      }
      const p = this.getTileWorldPos!(sq);
      return new THREE.Vector3(p.x, pion['baseHeight'] as number, p.z);
    }, () => {
      this.bus.emit({ type: 'pion-moved', playerIndex, from: fromSq, to: toSq });
      onDone();
    });
  }

  private animatePionAlongCurve(
    playerIndex: number,
    curve: THREE.Curve<THREE.Vector3>,
    fromSq: number,
    toSq: number,
    durationMs: number,
    onDone: () => void,
    extraOffset?: (t: number) => number
  ): void {
    const pion = this.pions[playerIndex];
    if (!pion) { onDone(); return; }
    pion.moveAlongCurve(curve, durationMs, toSq, () => {
      this.bus.emit({ type: 'pion-moved', playerIndex, from: fromSq, to: toSq });
      onDone();
    }, extraOffset);
  }

  private transitionTo(next: GameState): void {
    const from = this.state;
    if (from !== next) {
      try { assertTransition(from, next); }
      catch (err) { console.error(`[Game] ${(err as Error).message} (forcing)`); }
    }
    this.state = next;
    this.bus.emit({ type: 'state-changed', from, to: next });
  }

  private persistSave(): void {
    if (this.state === GameState.GAME_OVER) return;
    if (this.players.length === 0) return;
    const save = buildSave(
      this.seed,
      this.rng,
      this.activePlayerIndex,
      this.difficulty,
      this.players.map((p) => ({
        index: p.index,
        name: p.name,
        isHuman: p.isHuman,
        botDifficulty: p.botDifficulty,
        square: p.square
      })),
      this.playerCostume
    );
    // Save throwCount into rngState field (repurposing as a counter)
    save.rngState = this.throwCount;
    writeSave(save);
  }

  // --- headless test helpers ---

  simulateMatch(maxTurns = 5000): { winnerIndex: number; turns: number } {
    // Use crypto=false and a fresh seed; the player list is already
    // initialized via newMatch.
    let turns = 0;
    while (this.state !== GameState.GAME_OVER && turns < maxTurns) {
      // Force-resolve current state machine until game over
      this.advanceSimulatedTurn();
      turns++;
    }
    if (this.state !== GameState.GAME_OVER) {
      throw new Error(`simulateMatch: no winner after ${turns} turns`);
    }
    return { winnerIndex: this.activePlayerIndex, turns };
  }

  private advanceSimulatedTurn(): void {
    const p = this.players[this.activePlayerIndex]!;
    // For each throw (up to 3), pick values via the RNG
    // Simulate the bot's lock decisions if it's a bot
    if (!p.isHuman && p.bot) {
      let throwsLeft = 3;
      let accumulatedSum = 0;
      const locked: [boolean, boolean] = [false, false];
      const view: BotView = {
        myIndex: p.index,
        mySquare: p.square,
        opponents: this.players.filter(o => o.index !== p.index).map(o => ({ index: o.index, square: o.square })),
        rng: this.rng
      };
      while (throwsLeft > 0) {
        const a = locked[0] ? accumulatedSum : this.rng.d6();
        const b = locked[1] ? 0 : this.rng.d6();
        const values: [number, number] = locked[0] ? [a, b] : [a, b];
        // Bot looks at current sum
        const currentSum = values[0] + values[1];
        this.diceState = { ...this.diceState, values, locked, throwsUsed: 4 - throwsLeft } as DiceState;
        const locks = p.bot.decideLocks(view, this.diceState);
        if (locks[0] && locks[1]) {
          accumulatedSum = currentSum;
          break;
        }
        // Else: more throws coming
        if (locks[0]) accumulatedSum = values[0]!;
        if (locks[1]) accumulatedSum = values[1]!;
        locked[0] = locks[0];
        locked[1] = locks[1];
        throwsLeft--;
        if (throwsLeft === 0) {
          // Commit: sum of locked + final values
          accumulatedSum = values[0]! + values[1]!;
          break;
        }
      }
      this.applyCommittedSumImmediate(p, accumulatedSum);
    } else {
      // Human: just roll 2d6 once
      const a = this.rng.d6();
      const b = this.rng.d6();
      this.applyCommittedSumImmediate(p, a + b);
    }
  }

  private applyCommittedSumImmediate(p: InternalPlayer, sum: number): void {
    let target = p.square + sum;
    if (target > 100) target = 100 - (target - 100);
    p.square = target;
    const snake = getSnakeAt(target);
    if (snake) p.square = snake.to;
    const ladder = getLadderAt(target);
    if (ladder) p.square = ladder.to;
    if (p.square === 100) {
      this.activePlayerIndex = p.index;
      this.state = GameState.GAME_OVER;
      this.bus.emit({ type: 'game-over', winnerIndex: p.index, winnerName: p.name });
      return;
    }
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
  }
}

export { squareToWorld };
export { saveExists };
