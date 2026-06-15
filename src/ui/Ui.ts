/**
 * UI controller. Reads the EventBus and updates the HTML overlay.
 * Knows nothing about THREE.js. Slice 2 additions: menu modal, die-locking
 * tray, resume button.
 */
import type { EventBus } from '../game/EventBus';
import type { Game } from '../game/Game';
import { saveExists } from '../game/SaveLoad';
import { makeBatikDataUrl } from '../scene/BatikTextures';
import type { TriviaQuestion } from '../game/Trivia';
import { getTrivia } from '../game/Trivia';

export interface PlayerSlotInfo {
  index: number;
  name: string;
  isHuman: boolean;
  isBot: boolean;
}

export class UiController {
  private bus: EventBus;
  private game: Game | null = null;
  private diceButton: HTMLButtonElement;
  private diceFaceEl: HTMLElement;
  private diceTray: HTMLElement;
  private dieSlots: HTMLButtonElement[] = [];
  private turnNameEl: HTMLElement;
  private turnIndicatorEl: HTMLElement;
  private scorePanelEl: HTMLElement;
  private toastEl: HTMLElement;
  private winModalEl: HTMLElement;
  private winMessageEl: HTMLElement;
  private winRestartEl: HTMLButtonElement;
  private triviaModalEl: HTMLElement;
  private triviaMonumentEl: HTMLElement;
  private triviaQuestionEl: HTMLElement;
  private triviaChoicesEl: HTMLElement;
  private triviaFeedbackEl: HTMLElement;
  private triviaFactEl: HTMLElement;
  private triviaContinueEl: HTMLButtonElement;
  private menuModalEl: HTMLElement;
  private menuStartBtn: HTMLButtonElement;
  private menuResumeBtn: HTMLButtonElement;
  private diffButtons: HTMLButtonElement[] = [];
  private costumeButtons: HTMLButtonElement[] = [];
  private playerSlots: Map<number, { nameEl: HTMLElement; squareEl: HTMLElement; slotEl: HTMLElement }> = new Map();
  private currentToastTimeout: number | null = null;
  private onDiceClickHandler: (() => void) | null = null;
  private onRestartClick: (() => void) | null = null;
  private onNewMatch: ((difficulty: 'easy' | 'medium' | 'hard', costume: string) => void) | null = null;
  private onResume: (() => void) | null = null;
  private selectedDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  private selectedCostume: string = 'parang';

  constructor(bus: EventBus) {
    this.bus = bus;
    this.diceButton = this.requiredEl<HTMLButtonElement>('#dice-button');
    this.diceFaceEl = this.requiredEl<HTMLElement>('#dice-button .dice-face');
    this.diceTray = this.requiredEl<HTMLElement>('#dice-tray');
    this.turnNameEl = this.requiredEl<HTMLElement>('#turn-indicator .turn-name');
    this.turnIndicatorEl = this.requiredEl<HTMLElement>('#turn-indicator');
    this.scorePanelEl = this.requiredEl<HTMLElement>('#score-panel');
    this.toastEl = this.requiredEl<HTMLElement>('#toast');
    this.winModalEl = this.requiredEl<HTMLElement>('#win-modal');
    this.winMessageEl = this.requiredEl<HTMLElement>('#win-message');
    this.winRestartEl = this.requiredEl<HTMLButtonElement>('#win-restart');
    this.triviaModalEl = this.requiredEl<HTMLElement>('#trivia-modal');
    this.triviaMonumentEl = this.requiredEl<HTMLElement>('#trivia-monument');
    this.triviaQuestionEl = this.requiredEl<HTMLElement>('#trivia-title');
    this.triviaChoicesEl = this.requiredEl<HTMLElement>('#trivia-choices');
    this.triviaFeedbackEl = this.requiredEl<HTMLElement>('#trivia-feedback');
    this.triviaFactEl = this.requiredEl<HTMLElement>('#trivia-fact');
    this.triviaContinueEl = this.requiredEl<HTMLButtonElement>('#trivia-continue');
    this.menuModalEl = this.requiredEl<HTMLElement>('#menu-modal');
    this.menuStartBtn = this.requiredEl<HTMLButtonElement>('#menu-start');
    this.menuResumeBtn = this.requiredEl<HTMLButtonElement>('#menu-resume');

    // Build die-slot click handlers
    this.dieSlots = Array.from(this.diceTray.querySelectorAll<HTMLButtonElement>('.die-slot'));
    for (let i = 0; i < this.dieSlots.length; i++) {
      const die = this.dieSlots[i]!;
      die.addEventListener('click', () => {
        if (this.game) this.game.humanToggleLock(i as 0 | 1);
      });
    }

    // Difficulty buttons
    this.diffButtons = Array.from(this.menuModalEl.querySelectorAll<HTMLButtonElement>('.diff-btn'));
    for (const btn of this.diffButtons) {
      btn.addEventListener('click', () => {
        const diff = btn.dataset['diff'] as 'easy' | 'medium' | 'hard';
        this.selectedDifficulty = diff;
        for (const b of this.diffButtons) {
          const isThis = b === btn;
          b.classList.toggle('selected', isThis);
          b.setAttribute('aria-checked', isThis ? 'true' : 'false');
        }
      });
    }

    // Costume picker buttons
    this.costumeButtons = Array.from(this.menuModalEl.querySelectorAll<HTMLButtonElement>('.costume-btn'));
    for (const btn of this.costumeButtons) {
      btn.addEventListener('click', () => {
        const costume = btn.dataset['costume']!;
        this.selectedCostume = costume;
        for (const b of this.costumeButtons) {
          const isThis = b === btn;
          b.classList.toggle('selected', isThis);
          b.setAttribute('aria-checked', isThis ? 'true' : 'false');
        }
      });
    }

    // Wire UI → bus
    this.diceButton.addEventListener('click', () => {
      if (this.onDiceClickHandler) this.onDiceClickHandler();
    });
    this.winRestartEl.addEventListener('click', () => {
      if (this.onRestartClick) this.onRestartClick();
    });
    this.menuStartBtn.addEventListener('click', () => {
      if (this.onNewMatch) this.onNewMatch(this.selectedDifficulty, this.selectedCostume);
    });
    this.menuResumeBtn.addEventListener('click', () => {
      if (this.onResume) this.onResume();
    });
    this.triviaContinueEl.addEventListener('click', () => this.hideTrivia());

    // Keyboard: space/enter to roll
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.onDiceClickHandler) {
          e.preventDefault();
          this.onDiceClickHandler();
        }
      }
    });

    // Wire bus → UI
    this.bus.on('turn-changed', (e) => {
      this.turnNameEl.textContent = e.playerName;
      this.turnIndicatorEl.dataset['active'] = String(e.playerIndex);
      this.scorePanelEl.querySelectorAll('.player-slot').forEach((el) => {
        const idx = Number((el as HTMLElement).dataset['player']);
        (el as HTMLElement).dataset['active'] = idx === e.playerIndex ? 'true' : 'false';
      });
    });

    this.bus.on('dice-rolled', (e) => {
      this.diceFaceEl.textContent = String(e.value);
    });

    this.bus.on('dice-state-changed', (e) => {
      this.renderDiceState(e.values, e.locked, e.throwsUsed);
    });

    this.bus.on('pion-moved', (e) => {
      const slot = this.playerSlots.get(e.playerIndex);
      if (slot) slot.squareEl.textContent = String(e.to);
    });

    this.bus.on('snake-triggered', (e) => {
      this.showToast(`${e.name}! -${e.from - e.to}`, 1800);
    });
    this.bus.on('ladder-triggered', (e) => {
      this.showToast(`${e.name}! +${e.to - e.from}`, 1800);
      // Trivia popup for human players (and only human — bots don't
      // need to learn). The UI listens for trivia-show; we emit it here.
      const player = this.game?.getPlayers()[e.playerIndex];
      if (player?.isHuman) {
        this.bus.emit({
          type: 'trivia-show',
          playerIndex: e.playerIndex,
          monumentName: e.name
        });
      }
    });
    this.bus.on('walk-back', (e) => {
      this.showToast(`TOO FAR! -${e.overshoot}`, 1800);
    });

    this.bus.on('toast', (e) => this.showToast(e.text, e.durationMs));

    this.bus.on('game-over', (e) => {
      this.winMessageEl.textContent = `${e.winnerName} wins!`;
      // Apply a batik pattern to the win card background, using the
      // winner's costume (or songket by default)
      const batikUrl = makeBatikDataUrl('parang', {
        fg: 0x1B2A4A,
        bg: 0xD4A843,
        accent: 0xC41E3A,
        size: 80
      });
      this.winModalEl.style.setProperty('--win-batik-url', `url(${batikUrl})`);
      this.winModalEl.classList.remove('hidden');
    });

    this.bus.on('trivia-show', (e) => {
      this.showTrivia(e.monumentName);
    });

    this.bus.on('state-changed', (e) => {
      // Allow clicking the dice button only during MENU (first throw) or
      // SET_ASIDE (re-roll). Both human-only states.
      this.setDiceEnabled(e.to === 'MENU' || e.to === 'SET_ASIDE');
      if (e.to === 'MENU') {
        // Reset the dice tray display (no values)
        this.renderDiceState([null, null], [false, false], 0);
      }
    });

    this.bus.on('match-started', () => {
      this.menuModalEl.classList.add('hidden');
      this.bus.emit({ type: 'menu-hidden' });
    });

    this.bus.on('menu-shown', () => {
      this.menuModalEl.classList.remove('hidden');
      // Refresh resume button visibility
      this.menuResumeBtn.classList.toggle('hidden', !saveExists());
    });
  }

  setGame(game: Game): void {
    this.game = game;
  }

  setPlayers(players: ReadonlyArray<PlayerSlotInfo>): void {
    this.scorePanelEl.innerHTML = '';
    this.playerSlots.clear();
    players.forEach((p) => {
      const slot = document.createElement('div');
      slot.className = 'player-slot';
      slot.dataset['player'] = String(p.index);
      const dot = document.createElement('span');
      dot.className = 'dot';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = p.name;
      const sq = document.createElement('span');
      sq.className = 'square';
      sq.textContent = '1';
      slot.append(dot, name, sq);
      this.scorePanelEl.appendChild(slot);
      this.playerSlots.set(p.index, { nameEl: name, squareEl: sq, slotEl: slot });
    });
  }

  setDiceEnabled(enabled: boolean): void {
    this.diceButton.disabled = !enabled;
  }

  setDiceLabel(text: string): void {
    this.diceFaceEl.textContent = text;
  }

  /** Render the dice-tray DOM based on current DiceState. */
  private renderDiceState(values: [number | null, number | null], locked: boolean[], throwsUsed: number): void {
    for (let i = 0; i < 2; i++) {
      const slot = this.dieSlots[i];
      if (!slot) continue;
      const v = values[i];
      const face = slot.querySelector<HTMLElement>('.die-face');
      if (face) face.textContent = v === null ? '·' : String(v);
      const isLocked = locked[i] === true;
      slot.dataset['locked'] = isLocked ? 'true' : 'false';
      slot.dataset['empty'] = v === null ? 'true' : 'false';
      slot.setAttribute('aria-label', `Die ${i + 1}${v !== null ? `: ${v}` : ''}${isLocked ? ' (locked)' : ''}`);
    }
    // Big dice button: show sum of current values, or "?" before any throw
    const sum = (values[0] ?? 0) + (values[1] ?? 0);
    if (throwsUsed === 0) {
      this.diceFaceEl.textContent = '?';
    } else {
      this.diceFaceEl.textContent = String(sum);
    }
    // Change the button label to suggest re-roll or commit
    const label = this.diceButton.querySelector<HTMLElement>('.dice-label');
    if (label) {
      if (throwsUsed === 0) label.textContent = 'Roll';
      else if (throwsUsed >= 3) label.textContent = 'Done';
      else label.textContent = locked.every(l => l) ? 'Done' : 'Re-roll';
    }
  }

  showMenu(): void {
    this.menuModalEl.classList.remove('hidden');
    this.menuResumeBtn.classList.toggle('hidden', !saveExists());
    this.bus.emit({ type: 'menu-shown' });
  }

  hideMenu(): void {
    this.menuModalEl.classList.add('hidden');
    this.bus.emit({ type: 'menu-hidden' });
  }

  showToast(text: string, durationMs: number): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    if (this.currentToastTimeout !== null) window.clearTimeout(this.currentToastTimeout);
    this.currentToastTimeout = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
      this.currentToastTimeout = null;
    }, durationMs);
  }

  hideWinModal(): void {
    this.winModalEl.classList.add('hidden');
  }

  /**
   * Show a trivia question for the named monument. The question is
   * pulled from the trivia DB; if none exists, the popup stays
   * hidden. Choices are rendered as buttons; clicking one marks the
   * answer (correct/wrong) and reveals the fun fact.
   */
  showTrivia(monumentName: string): void {
    const question = getTrivia(monumentName);
    if (!question) return;
    this.triviaMonumentEl.textContent = monumentName;
    this.triviaQuestionEl.textContent = question.q;
    this.triviaChoicesEl.innerHTML = '';
    this.triviaFeedbackEl.classList.add('hidden');
    question.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.className = 'trivia-choice';
      btn.type = 'button';
      btn.textContent = `${String.fromCharCode(65 + idx)}. ${choice}`;
      btn.addEventListener('click', () => {
        this.handleTriviaAnswer(btn, idx, question);
      });
      this.triviaChoicesEl.appendChild(btn);
    });
    this.triviaModalEl.classList.remove('hidden');
  }

  hideTrivia(): void {
    this.triviaModalEl.classList.add('hidden');
    this.bus.emit({ type: 'trivia-hide' });
  }

  private handleTriviaAnswer(clicked: HTMLButtonElement, idx: number, question: TriviaQuestion): void {
    const correct = idx === question.correctIndex;
    // Disable all choices
    const allChoices = Array.from(this.triviaChoicesEl.querySelectorAll<HTMLButtonElement>('.trivia-choice'));
    for (const btn of allChoices) {
      btn.disabled = true;
    }
    // Highlight correct + wrong
    if (correct) {
      clicked.classList.add('correct');
    } else {
      clicked.classList.add('wrong');
      allChoices[question.correctIndex]?.classList.add('correct');
    }
    // Show feedback
    this.triviaFactEl.textContent = (correct ? 'Benar! 🎉 ' : 'Hampir! ') + question.fact;
    this.triviaFeedbackEl.classList.remove('hidden');
    // Emit answer event
    this.bus.emit({ type: 'trivia-answer', playerIndex: 0, correct });
  }

  onDiceClick(fn: () => void): void { this.onDiceClickHandler = fn; }
  onWinRestart(fn: () => void): void { this.onRestartClick = fn; }
  onNewMatchClick(fn: (difficulty: 'easy' | 'medium' | 'hard', costume: string) => void): void { this.onNewMatch = fn; }
  onResumeClick(fn: () => void): void { this.onResume = fn; }

  private requiredEl<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`UI: required element not found: ${selector}`);
    return el;
  }
}
