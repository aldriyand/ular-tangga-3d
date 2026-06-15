# Ular Tangga Nusantara

A 3D snakes-and-ladders game themed around the Indonesian archipelago.

Built with **Three.js + Vite + TypeScript**. All art is procedurally generated — no
external models, no audio files, no asset pipeline. The whole project ships as
~63 KB of game code plus the Three.js runtime.

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/
```

## Quick start

```bash
git clone <repo>
cd ular-tangga-3d
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Pick a difficulty
(Easy / Medium / Hard), choose your batik costume, and click **New match**.

To run the production build:

```bash
npm run build      # bundles to dist/
npm run preview    # serves the dist/ build locally
```

To run the test suite:

```bash
npm test           # vitest, one-shot
npm run test:watch # vitest, watch mode
```

## How to play

- **Goal**: be the first pion to land exactly on square 100. If you roll
  too far, you walk back the overshoot.
- **Ladders** (yellow): land on the bottom and you climb to the top.
- **Snakes** (red): land on the head and you slide to the tail.
- **Dice**: two 6-sided dice, rolled simultaneously. You can **lock** one or
  both dice and re-roll the rest, up to 3 throws per turn.
- **Trivia**: when you land on a ladder, a question about the monument pops up.
  Pick the right answer and learn something.

### Controls

| Action | Mouse / touch | Keyboard |
|---|---|---|
| Roll dice | Click **Roll** | `Space` / `Enter` |
| Lock a die | Click the die | (no shortcut yet) |
| Switch camera mode | Click the **camera** button (cycles isometric → free-orbit → follow) | (no shortcut yet) |
| Rotate camera (free-orbit) | Drag with the mouse / one-finger drag | (no shortcut yet) |
| Zoom camera (free-orbit) | Mouse wheel / two-finger pinch | (no shortcut yet) |
| Mute / unmute | Click the speaker icon | (no shortcut yet) |
| Open menu | Refresh the page | `F5` |

## Features

### Game mechanics
- 100-tile board in classic S-pattern
- 5 Indonesian cultural regions (Sumatra, Java, Kalimantan, Sulawesi, Papua)
- 9 snakes + 7 ladders themed to the archipelago
- 2d6 dice with Farkle-style set-aside (3 throws max)
- 3 bot difficulty levels with real strategic differentiation
- Win: exact roll to 100, overshoot walks back

### Visuals
- 9 distinct snake shapes (S-curve, spiral coil, zigzag, loop, arch, etc.)
- 7 stylized 3D cultural monuments (Candi Borobudur, Candi Prambanan,
  Istana Maimun, Benteng Rotterdam, Monas, Candi Sewu, Taman Nasional Komodo)
- 5 procedural batik tile patterns (parang, ulos, kawung, poleng, ukir)
- Stylized 2.5D Indonesia archipelago base under the tiles
- Player costume picker (5 batik patterns, 2-3 color
   variants per pattern) — bots keep their assigned costumes
- Snake tubes route around the dice (keep-out zone with 2-stage geometry fix)
- Dice lifted above snake arc peak with parabolic bounce physics
- Camera modes: isometric, follow-pion, win-sweep orbital, **free-orbit**
  (drag to rotate, wheel/pinch to zoom)

### Audio (procedural, no audio files)
- 5 sound effects synthesized with Web Audio API
- Dice click, snake slide, ladder climb chime, win arpeggio, lock tick
- Mute toggle in the dice area

### Cultural learning
- 18 trivia questions across the 7 monuments
- Correct/wrong answer feedback with fun fact
- Kid-friendly Indonesian + English mix

### UX
- Mobile-first responsive layout
- Save/resume match to localStorage
- Player costume persisted in save
- A11y: aria-labels, keyboard roll, prefers-reduced-motion, prefers-color-scheme
- Zero console errors

## Architecture

```
src/
  main.ts                      # Entry point. Wires Scene + Game + UI + Audio.
  audio/                       # Procedural Web Audio engine
    AudioEngine.ts             # 5 SFX, master gain, mute toggle
  components/                  # 3D objects in the scene
    Dice.ts                    # 2d6 with set-aside, bounce animation
    Pion.ts                    # Player piece, costume texture swap
    Snake.ts                   # Procedural snake geometry, 9 styles
    Ladder.ts                  # Procedural monument geometry, 7 buildings
  data/                        # Static game data
    board.ts                   # Snakes, ladders, regions, isSquareType()
    path.ts                    # square → world position mapping
  game/                        # Pure game logic, no Three.js
    Game.ts                    # Orchestrator, FSM, animation dispatch
    GameState.ts               # State enum + allowed-transitions table
    EventBus.ts                # Typed pub/sub
    Bot.ts                     # Easy/Medium/Hard AI
    Rng.ts                     # Mulberry32 + crypto-fallback
    SaveLoad.ts                # localStorage schema v1
    RngSerializer.ts           # RNG rehydration for resume
    Trivia.ts                  # 18 questions across 7 monuments
  scene/                       # Three.js scene construction
    SceneRoot.ts               # Camera, lights, rAF loop, updater list
    Geometry.ts                # Board, tiles, snakes, ladders, labels
    Archipelago.ts             # 5 stylized islands + ocean
    BatikTextures.ts           # 5 procedural batik patterns + costumes
    CameraController.ts        # 3 camera modes, smooth transitions
  ui/                          # HTML overlay controller
    Ui.ts                      # Reads EventBus, updates DOM modals
```

### Event-driven

The Game emits typed events (`snake-triggered`, `ladder-triggered`, `game-over`,
`trivia-show`, etc.) and the UI/Audio/Menu subscribe. Components don't know
about each other — they all talk to the bus. This makes it easy to add new
listeners (e.g. analytics) without touching game code.

### Why procedural everything

- **No licensing**. Every sound, every texture, every model is generated at
  runtime. Nothing to attribute.
- **Tiny bundle**. The whole game code is ~63 KB. The Three.js runtime is the
  bulk of the download.
- **Offline-ready**. Nothing fetches anything once the page is loaded.
- **Tunable**. Want a different batik palette? Change three numbers in
  `BatikTextures.ts`. Want a different dice bounce? Change one constant in
  `Dice.ts`.

## Tech stack

- **Three.js** r0.160 — 3D rendering
- **Vite** — dev server, bundler, HMR
- **TypeScript** — strict-ish type checking
- **Vitest** — headless test runner
- **No CSS framework** — hand-written mobile-first CSS with custom properties

## Browser support

Tested on:
- Chrome / Edge (current)
- Firefox (current)
- Safari (current)

WebGL 2.0 required. Touch input supported. Web Audio API required for sound
(graceful degradation — no audio on browsers that lack it).

## Slice changelog

The game was built incrementally. Each slice added new systems; nothing was
removed.

- **Slice 1 (kickoff)**: Project scaffold, 3D board geometry, snake tubes,
  ladder rails, FSM (MENU/ROLLING/MOVING/SNAKE/LADDER/WALK_BACK/BOT_THINK/
  GAME_OVER), 4 pions, animated dice, three camera modes, bot AI, HTML overlay.
- **Slice 2**: Mobile-first responsive layout, Farkle-style 2d6 dice-locking
  with real bot differentiation, save/load to localStorage, a11y polish.
- **Slice 3**: 9 distinct snake shapes (procedural S-curve, coil, zigzag,
  loop, arch, etc.), 7 stylized 3D cultural monuments (Borobudur, Prambanan,
  Maimun, Rotterdam, Monas, Sewu, Komodo), 2.5D Indonesia archipelago base,
  curve-following pion animation on snake/ladder events.
- **Slice 4**: Procedural batik textures (parang/kawung/poleng/ulos/ukir)
  on tiles, pions, and win modal, win-sweep camera wired to game-over,
  dice-bounce physics (parabolic arc + bounce).
- **Slice 5**: Overlap-fix polish. Snakes route around the dice (2-stage
  defense: control-point push + tube-vertex clamp, keep-out radius 0.9).
  Dice lifted to y=1.5 (above snake peak). Number labels enlarged and
  outlined for readability.
- **Slice 6**: Pion costume picker (5 batik patterns with color variants),
  procedural SFX (5 effects via Web Audio API, no audio files), trivia
  popup on ladder landings (18 questions, 7 monuments).
- **Slice 7 (this slice)**: README, i18n (English/Indonesian), headless test
  harness (Vitest).

## Future work

- **PWA / offline**: service worker, manifest, install prompt
- **Background music**: procedurally generated gamelan-style loop (no
  audio files — same philosophy as the SFX)
- **Snake trivia**: a "what does this creature symbolize?" question on
  snake landings (currently only ladders get questions)
- **More monuments**: more Indonesian cultural sites, more trivia
- **Camera orbit / pan**: free-form camera control for exploring the scene
- **Online multiplayer**: 2+ players over WebSocket

## Attributions

This project stands on the shoulders of giants:

- **Three.js** — [mrdoob and contributors](https://threejs.org/), MIT license
- **Vite** — [Evan You and contributors](https://vitejs.dev/), MIT license
- **TypeScript** — [Microsoft](https://www.typescriptlang.org/), Apache 2.0
- **Vitest** — [vitest-dev](https://vitest.dev/), MIT license

The cultural monuments are inspired by real Indonesian sites but are
stylized 3D models, not accurate representations. Trivia answers are
drawn from general knowledge — please open an issue if you spot a factual
error.

## License

MIT. See `LICENSE` for the full text. (TBD — add this file if you want to
publish.)
