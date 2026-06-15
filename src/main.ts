/**
 * Entry point. Wires Scene + Game + UI together and exposes the Game as
 * `window.__game` for debugging (matches the convention from the prior
 * Phaser project — see memory).
 *
 * Slice 2: shows the menu on boot, waits for the user to start a new match
 * or resume a saved one.
 */
import * as THREE from 'three';
import { SceneRoot } from './scene/SceneRoot';
import { BoardGeometry } from './scene/Geometry';
import { Dice } from './components/Dice';
import { Pion } from './components/Pion';
import { Game } from './game/Game';
import { UiController, type PlayerSlotInfo } from './ui/Ui';
import { squareToWorld } from './data/path';
import { getPionCostume, type PionCostumeSpec } from './scene/BatikTextures';
import { AudioEngine } from './audio/AudioEngine';

const PLAYER_SPECS: ReadonlyArray<PlayerSlotInfo> = [
  { index: 0, name: 'Player',      isHuman: true,  isBot: false },
  { index: 1, name: 'Bot Ulos',    isHuman: false, isBot: true  },
  { index: 2, name: 'Bot Batik',   isHuman: false, isBot: true  },
  { index: 3, name: 'Bot Songket', isHuman: false, isBot: true  }
];

const PION_BASE_HEIGHTS = [0.18, 0.18, 0.18, 0.18];

/** Costume presets for the bots (the player picks theirs from the menu). */
const BOT_COSTUMES: ReadonlyArray<PionCostumeSpec> = [
  getPionCostume('ulos'),    // Bot Ulos
  getPionCostume('poleng'),  // Bot Batik
  getPionCostume('kawung')   // Bot Songket
];

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('main: #game-canvas not found');

  const sceneRoot = new SceneRoot(canvas);
  const board = new BoardGeometry();
  sceneRoot.scene.add(board.group);

  // Dice — positioned at the center of the board, lifted above the
  // snake arc peak (~1.1 for typical mid-board snakes) so the dice
  // is the highest visual element and never overlaps the snakes.
  const dice = new Dice();
  dice.mesh.position.set(0, 1.5, 0);
  sceneRoot.scene.add(dice.mesh);

  // Pions — each wears a distinct batik "costume" so players are
  // recognizable in the 3D scene, not just by their color.
  // The player starts with a default (parang) and is updated when
  // they pick a costume in the menu. Bots keep their assigned costumes.
  const pions: Pion[] = PLAYER_SPECS.map((spec, i) => {
    const costume = i === 0 ? getPionCostume('parang') : BOT_COSTUMES[i - 1]!;
    const pion = new Pion(
      {
        index: spec.index,
        name: spec.name,
        color: 0xffffff,            // unused when costume is set
        costume
      },
      PION_BASE_HEIGHTS[i]!
    );
    sceneRoot.scene.add(pion.mesh);
    return pion;
  });

  // Game
  const game = new Game({ useCrypto: false });

  // Audio engine — synthesized SFX (no audio files, all procedural)
  const audio = new AudioEngine();

  // Audio toggle (mute/unmute)
  const audioToggle = document.getElementById('audio-toggle') as HTMLButtonElement | null;
  if (audioToggle) {
    audioToggle.dataset['muted'] = String(audio.isMuted());
    audioToggle.addEventListener('click', () => {
      const newMuted = !audio.isMuted();
      audio.setMuted(newMuted);
      audioToggle.dataset['muted'] = String(newMuted);
    });
  }

  // Wire SFX to game events. The audio context is created on the first
  // user gesture (the dice click or audio toggle click).
  game.bus.on('dice-rolled', () => audio.play('dice-rolled'));
  game.bus.on('snake-triggered', () => audio.play('snake'));
  game.bus.on('ladder-triggered', () => audio.play('ladder'));
  game.bus.on('game-over', () => audio.play('win'));
  // Hook dice click to ensure audio context (first user gesture)
  const ensureAudioOnFirstClick = (): void => {
    audio.ensureContext();
    document.removeEventListener('click', ensureAudioOnFirstClick);
  };
  document.addEventListener('click', ensureAudioOnFirstClick, { once: true });

  // UI
  const ui = new UiController(game.bus);
  ui.setGame(game);
  ui.setPlayers(PLAYER_SPECS);

  // Bind scene deps to the game
  game.bindScene({
    pions,
    getTileWorldPos: (sq) => {
      if (sq === 0) {
        const p = squareToWorld(1);
        return new THREE.Vector3(p.x, 0, p.z);
      }
      return board.getTileWorldPosition(sq);
    },
    dice: {
      roll: (v, onDone) => dice.roll(v, onDone),
      snapToValue: (d, v) => dice.snapToValue(d, v),
      update: dice.update,
      value: [dice.value[0], dice.value[1]]
    },
    getSnakeVisual: (sq) => board.getSnakeAt(sq),
    getLadderVisual: (sq) => board.getLadderAt(sq),
    cameraController: sceneRoot.cameraController
  });

  ui.onDiceClick(() => {
    if (game.getState() === 'SET_ASIDE') {
      // Click on the big dice button when in SET_ASIDE = commit
      game.humanCommit();
    } else {
      game.humanRoll();
    }
  });
  ui.onNewMatchClick((difficulty, costume) => {
    ui.hideMenu();
    ui.hideWinModal();
    game.bus.emit({ type: 'match-started', difficulty });
    game.newMatch(difficulty, costume);
    // Update the player pion's costume to match the pick
    const playerPion = pions[0];
    if (playerPion) {
      const spec = getPionCostume(costume);
      playerPion.setCostume(spec);
    }
  });
  ui.onResumeClick(() => {
    ui.hideMenu();
    ui.hideWinModal();
    const ok = game.resumeMatch();
    if (!ok) {
      // Fall back to new match
      game.newMatch('medium');
    } else {
      // Restore the player's saved costume on the pion
      const playerPion = pions[0];
      if (playerPion) {
        const spec = getPionCostume(game.getPlayerCostume());
        playerPion.setCostume(spec);
      }
      game.bus.emit({ type: 'match-started', difficulty: game.getDifficulty() });
    }
  });
  ui.onWinRestart(() => {
    ui.hideWinModal();
    ui.showMenu();
  });

  // Camera follow the active pion
  sceneRoot.onUpdate(() => {
    const active = game.getActivePlayerIndex();
    const pion = pions[active];
    if (pion) {
      const sq = pion.square === 0 ? 1 : pion.square;
      const wp = board.getTileWorldPosition(sq);
      sceneRoot.cameraController.setFollowTarget(wp.x, wp.y, wp.z);
    }
  });

  // Per-component updaters
  sceneRoot.onUpdate(dice.update);
  for (const pion of pions) {
    sceneRoot.onUpdate(pion.update);
  }

  // Expose for dev
  (window as unknown as { __game: Game }).__game = game;
  (window as unknown as { __scene: SceneRoot }).__scene = sceneRoot;

  // Start
  sceneRoot.start();
  ui.showMenu(); // show the main menu; do NOT auto-start a match

  console.log('[ular-tangga-3d] booted. Menu is open. Click "New match" to start.');
  console.log('[ular-tangga-3d] dev: __game.simulateMatch(n) for headless match simulation');
}

main();
