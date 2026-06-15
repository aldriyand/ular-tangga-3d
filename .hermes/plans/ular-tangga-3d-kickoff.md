# Ular Tangga 3D — Kickoff Plan

## Source documents
- `D:\Workspace\game-design.md` — original design doc v1 (223 lines, Indonesian theme, Three.js)
- This file — decisions, scope, and the build order for slice 1
- `## Slice 2 changelog` (below) — what was added in slice 2 (mobile, dice-locking, save/load)

## Locked decisions (from kickoff Q&A, 2026-06-15)

| Decision | Choice | Rationale |
|---|---|---|
| Stack | Vite + TypeScript + Three.js | Matches design doc; lets us share TS types with the data layer |
| Win rule | **Exact roll to 100, overshoot walks back** | Most dramatic; best for kids; standard Indonesian ular tangga rule |
| Trivia on special squares | **Deferred to v2** | Focus on board game purity first; trivia needs cultural sourcing |
| 2D canvas fallback | **Cut** | Effectively writing the game twice; test on old Android, lower pixel ratio instead |
| Audio (original composition) | **Deferred** | License a CC0/BY gamelan loop for v1; original composition for v2 |
| Workflow | **I drive end-to-end, can delegate independent chunks to parallel subagents** | Speed up the parallelizable early work (art, audio stubs, tests) |
| State management | **Plain TS class + EventBus; no Redux/Zustand** | FSM is small, FSM is the right tool |

## Scope of slice 1 (this kickoff)

A working, browser-runnable game that lets 1 human + up to 3 bots play a complete match on a stub board (primitive geometry, no real 3D art) with the full rule set. "Complete match" = roll, move, snake, ladder, exact-100, walk-back, win.

### In scope for slice 1
- Project scaffold (Vite + TS + Three.js, `npm run dev` and `npm run build` work)
- FSM with states MENU, ROLLING, MOVING, SNAKE, LADDER, WALK_BACK, BOT_THINK, GAME_OVER
- EventBus for component-to-component communication
- Deterministic RNG (seeded, can be replaced with crypto.getRandomValues in production)
- Board data: snake table, ladder table, region table, path tracer
- Board 3D geometry: 100 numbered tiles laid out as a 10x10 grid in classic S-pattern, raised above an Indonesia-shaped base plane (silhouette only, no real geography yet)
- Dice: 3D cube, click-to-roll, animation, returns 1-6
- Pion: 4 pions, one per player, each is a capsule of a different color (costume slots defined in code, primitives for slice 1)
- Snake/ladder visuals: placeholder (red line for snake, green ramp for ladder) — real models deferred
- Camera: isometric by default, follow-pion mode, win sweep
- Bot AI: base class + Easy (random) + Medium (prefers ladders, avoids snakes 1-step lookahead) + Hard (2-step lookahead + position-aware)
- UI overlay (HTML, not WebGL): turn indicator, score panel, dice button, win modal
- Verification: tsc clean, vite build clean, end-to-end loop verified by simulating a full game via console

### Out of scope for slice 1 (deferred)
- Real 3D models (.glb) for pions, snakes, ladders, dice — primitives in slice 1
- Real Indonesian archipelago outline — placeholder silhouette
- Real batik/ulos/songket textures on pions — flat color
- All audio (SFX + music)
- Save/load to localStorage
- Mobile touch optimization (works on desktop, may be tiny on mobile)
- Trivia on special squares
- Multiplayer
- Accessibility pass (reduced motion, screen reader, keyboard)
- i18n (English/Indonesian)
- PWA / offline
- Original gamelan composition

## Build order (for delegation)

Tasks 1-4 must be sequential (each depends on the previous). Tasks 5-7 can run in parallel after task 4. Task 8 depends on 5, 6, 7. Task 9 depends on 8.

1. **Scaffold** — `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `style.css`, folder structure
2. **Core systems** — `GameState` enum, `EventBus`, `Game` class, `TurnManager`, `Rng`
3. **Data layer** — `board.ts` (snake/ladder/region tables), `path.ts` (square → world coord), `geometry.ts` (3D board mesh)
4. **3D scene** — `scene.ts` (renderer, camera, lights, render loop), `camera.ts` (mode switching)
5. **Components** (parallelizable):
   - `Dice.ts` — 3D cube, roll animation, returns value
   - `Pion.ts` — player piece, costume slot, position interpolation
   - `Snake.ts` and `Ladder.ts` — placeholder visuals, slide/climb animations
6. **Bot AI** — `Bot.ts` base + `EasyBot`, `MediumBot`, `HardBot` (differentiated)
7. **UI overlay** — `index.html` markup + `style.css` + `ui.ts` to wire buttons/events
8. **Glue** — `main.ts` instantiates Game, wires systems, starts render loop
9. **Verify** — tsc, build, dev server smoke test, end-to-end loop

## File structure (target)

```
D:\Workspace\ular-tangga-3d\
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  style.css
  src/
    main.ts
    game/
      Game.ts
      GameState.ts          // enum + transition table
      EventBus.ts
      TurnManager.ts
      Rng.ts
    data/
      board.ts              // snake/ladder/region tables
      path.ts               // square (1-100) → world XYZ
    scene/
      SceneRoot.ts          // renderer, camera, lights, render loop
      CameraController.ts   // isometric / follow / win-sweep modes
      Geometry.ts           // board mesh, tile mesh, pion placeholder
    components/
      Dice.ts
      Pion.ts
      Snake.ts
      Ladder.ts
    ai/
      Bot.ts
      EasyBot.ts
      MediumBot.ts
      HardBot.ts
    ui/
      Ui.ts                 // HTML overlay controller
    utils/
      math.ts
      animation.ts          // tweens, easings
  .hermes/
    plans/
      ular-tangga-3d-kickoff.md   // this file
```

## Verification recipe (run at end of slice 1)

```bash
cd D:\Workspace\ular-tangga-3d
npx tsc --noEmit                 # type check, expect 0 errors
npm run build                    # Vite build, expect dist/ created
npm run dev &                    # start dev server
# In browser, open the URL Vite prints (usually http://localhost:5173)
# In DevTools console:
window.__game.simulateMatch(50)  # run 50 simulated games headless, log win distribution
window.__game.start()            # human-playable match
# Verify: roll dice, see pion move, hit a snake, hit a ladder, walk back on overshoot, win modal
```

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Three.js bundle is ~600KB — bad for old phones | Lazy-load dice and snake models; ship dice as primitive cube in slice 1; defer real models |
| Bot AI feels random even at "Hard" | Hard uses 2-step lookahead with snake penalty + ladder bonus + 99-tiebreaker |
| Pions overlap on same square | Vertical offset: each pion sits at a different Y (player highest, bots stacked) until 2+ land on same square, then small XZ offset |
| Win-cinematic camera sweep is janky | Use Catmull-Rom curve; ease in/out; abort on user click to skip |
| 100 squares × 16-tile neighbor lookups × per-frame = perf | Pre-compute path array once, neighbors are O(1) lookup |
| Walk-back on overshoot confusing for kids | Visual telegraph: pion stops at 100, then walks back N with a "TOO FAR!" toast |

## Open questions (parking lot for slice 2)

- Mobile layout: portrait vs landscape, virtual joystick, gesture for roll
- Save/load: localStorage shape, "continue last game" UX
- Pion costume: how do players customize? Avatar picker on menu? Random unlockable per region?
- Ladder climb animation: walk up the ramp, or fade in at top with the audio cue?
- Snake slide: arcing path or straight line? Eaten-by-snake vs slid-off?

---

## Slice 2 changelog (2026-06-15)

Slice 2 added: mobile-first responsive layout, Farkle-style dice-locking with real bot differentiation, save/load to localStorage, and a11y polish.

### What was delivered

| Feature | Status | Notes |
|---|---|---|
| Mobile-first layout | DONE | Viewport-fit=cover, safe-area-inset, 48px+ touch targets, portrait + landscape media queries, no overscroll |
| Dice-locking (2d6, Farkle-style) | DONE | 3 throws max, lock any subset of dice between throws, commit when satisfied |
| Bot AI — real differentiation | DONE | Easy commits immediately. Medium does 1 re-roll preferring ladder/snake targets. Hard does 2 re-rolls + position-aware (99-tiebreaker, snake avoidance) |
| Save/load to localStorage | DONE | Schema v1, Resume button on menu, auto-cleared on win, throw count tracked for repro |
| Main menu / difficulty picker | DONE | "New match" + "Resume match" + Easy/Medium/Hard radio |
| A11y polish | DONE | aria-labels on all interactive elements, aria-live for turn indicator, keyboard space/enter to roll, prefers-reduced-motion kills all animations |
| Simulate match | DONE | Headless test path now uses 2d6 with bot lock decisions |

### Files changed in slice 2

- `index.html` — menu modal, dice tray with 2 die slots, viewport meta, theme-color
- `style.css` — rewritten mobile-first, 4 media queries, dice tray layout, modal styles
- `src/components/Dice.ts` — rewritten as 2d6, returns `[d1, d2]`, supports per-die snap-to-value
- `src/components/Pion.ts` — unchanged
- `src/ai/Bot.ts` — added `decideLocks` hook; Easy/Medium/Hard make honest different decisions
- `src/game/Game.ts` — rewritten for dice-locking flow, save/load, menu gate, FSM extended
- `src/game/GameState.ts` — ROLLING → THROWING (rename) + SET_ASIDE added, transition table updated
- `src/game/EventBus.ts` — added `dice-state-changed`, `menu-shown/hidden`, `match-started` events
- `src/game/SaveLoad.ts` — NEW, schema v1 with throwCount for replay
- `src/game/RngSerializer.ts` — NEW (rough — RNG is reseeded, not state-replayed)
- `src/ui/Ui.ts` — rewritten to render dice tray, handle die-slot clicks, menu, keyboard
- `src/main.ts` — shows menu on boot, no auto-start

### Bug found and fixed during slice 2 verification

- Bot lock-decision setTimeout was firing BEFORE the dice animation completed
  (700ms vs 800ms). The state was still THROWING, so the bot's logic
  early-returned and never made a decision. Fixed by moving the lock-decision
  trigger into the dice animation's onDone callback.

### Slice 2 verification (real, not just compile)

- tsc --noEmit: 0 errors
- npm run build: clean, 34KB game bundle
- Headless browser: clicked "New match", played a turn, locked die 1,
  re-rolled, committed 4+4=8, advanced to bots, all 3 bots made
  dice-locking decisions, score panel updated to 8/7/5/7, 0 console errors
- 5 simulated matches via `__game.simulateMatch(n)`, all completed with
  different winners, 30-91 turn range
- "Resume match" button appeared after a save was created
- 4 media queries verified active in the loaded stylesheet

### Deferred (parking lot for slice 3+)

- Real 3D art: .glb snake/ladder models (Naga, Buaya, Candi, Monas), real Indonesia archipelago base, batik textures on tiles and pions
- Audio: CC0/BY gamelan loop + SFX
- Trivia scaffolding (deferred to v2 per kickoff Q&A)
- Bot v2 strategic features beyond dice-locking (probably need full hand-tracking Yahtzee-style)
- Pion costume customization UI
- i18n (English/Indonesian)
- PWA / offline
- Animated snake slide (arcing path) and ladder climb (walk up)

---

This plan is the source of truth for slice 1. If the design doc and this file disagree, this file wins for slice 1. Slice 2 changelog is additive.

## Slice 3 changelog (2026-06-15)

Slice 3 is the "make it look like an Indonesian cultural game" slice. Varied snake shapes, 7 stylized 3D monuments replacing the colored-tube ladders, a stylized 2.5D archipelago base, and curve-following pion animations on snake/ladder events.

### What was delivered

| Feature | Status | Notes |
|---|---|---|
| Varied snake shapes (9 distinct) | DONE | Each snake has its own procedural curve: S-curve (Naga Banda), spiral (Ular Naga Jawa), zigzag (Buaya Putih), tight waves (Lipan), loop (Naga Sari), coil (Ular Sawa), arch (Naga Tasik), scorpion (Kalajengking), V (Ular Kadal). Culture-tinted colors (gray crocodile, brown centipede, lake-blue serpent, etc.) + eyes |
| Stylized 3D monuments (7 ladders) | DONE | Borobudur = 3-tier stupa + finial. Prambanan = trapezoidal tower + 4 fluting strips + stepped roof + red pinnacle. Maimun = yellow palace + green dome + 4 minarets + doorway. Rotterdam = square fort + 4 corner towers + red roof slabs + arched gate. Monas = square base + tall obelisk + gold flame. Sewu = 4 small stupas in a square. Komodo = 2 pillars + jagged inner edge + curved arch + 2 dragon heads + pendant |
| Indonesia archipelago base | DONE | 5 stylized islands (Sumatra NW-SE thin, Java E-W long, Kalimantan big round, Sulawesi tall thin, Papua big wide), positioned roughly under their region tiles. Ocean plane + decorative wave rings. Floating labels (Sumatra/Java/Kalimantan/Sulawesi/Papua) at the side of each island. Tiles lifted to sit on island heights |
| Animated snake slide | DONE | Pion follows the snake's curve when sliding down. Added `Pion.moveAlongCurve()` and `Game.animatePionAlongCurve()` |
| Animated ladder climb | DONE | Pion follows the ladder's climb path with a 4-bob "climbing" y-bob. Reuses Ladder.getPath() |
| `Ladder.getPath()` / `Snake.getPath()` | DONE | Each visual exposes its climb/slide curve so the Game can drive animated motion along it |
| Tiles smaller (0.06 thick) | DONE | So the islands are visible around them; islands become the "ground" |

### Files changed in slice 3

- `src/components/Snake.ts` — rewritten with 9 style parameters (s-curve, coil, zigzag, waves, loop, spiral, arch, scorpion, v-shape), per-snake culture colors, head+tail spheres, eyes, `getPath()` exposing the curve
- `src/components/Ladder.ts` — rewritten with 7 monument builders, `getPath()` exposing the climb curve. ~20 sub-meshes per monument on average
- `src/components/Pion.ts` — added `moveAlongCurve()` for curve-following animation
- `src/scene/Archipelago.ts` — NEW, 5 stylized islands + ocean + labels
- `src/scene/Geometry.ts` — uses Archipelago; tiles lifted to island heights; exposes `getSnakeAt`/`getLadderAt` for the Game
- `src/game/Game.ts` — added `getSnakeVisual`/`getLadderVisual` deps, `animatePionAlongCurve` for snake/ladder animations, falls back to straight-line if visual is missing
- `src/main.ts` — passes `getSnakeVisual`/`getLadderVisual` resolvers to the game

### Slice 3 verification (real, not just compile)

- tsc --noEmit: 0 errors
- vite build: clean, 48KB game bundle (up from 34KB — extra geometry code)
- Headless browser: 362 meshes in the scene (up from 288), 409 total objects
- 5 islands × 2 meshes = 10 archipelago meshes, confirmed by group-name traversal
- 7 ladders × ~14 sub-meshes avg = 98 monument meshes, confirmed
- 9 snakes × 5 sub-meshes (tube + head + tail + 2 eyes) = 45 snake meshes
- Live game: rolled dice, committed 4+4, Bot Ulos landed on Borobudur (4→45), curve animation fired (LADDER event in event log)
- Headless simulateMatch: 195 turns, winner = Bot Batik (medium), 0 errors

### Bug found and fixed during slice 3 verification

- (none new; the slice-2 bot lock-decision setTimeout bug is still fixed in slice 2)

### Slice 3 backlog (still parked)

- Batik-pattern textures on tiles and pions (procedural CanvasTexture would be cheap)
- Audio (CC0/BY gamelan loop + SFX)
- Trivia scaffolding (deferred to v2 per kickoff Q&A)
- Pion costume customization UI
- i18n (English/Indonesian)
- PWA / offline
- Win-cinematic camera sweep (in CameraController but not wired to game-over)

### Slice 4+ ideas

- Procedural batik tile textures (CanvasTexture, no asset pipeline)
- Animated win-sweep camera (CameraController already has win-sweep mode, just needs wiring)
- Animated dice-rolling physics (currently a 3D rotation tween; could add bounce/settle)

## Slice 4 changelog (2026-06-15)

Slice 4 is the "polish" slice. Batik textures throughout, win-sweep cinematic on game-over, and proper dice-bounce physics.

### What was delivered

| Feature | Status | Notes |
|---|---|---|
| Procedural batik textures | DONE | 5 traditional patterns drawn to CanvasTexture: parang (Java), kawung (Kalimantan), poleng (Sulawesi), ulos (Sumatera), ukir (Papua). Real batik names, real colors per region. Module: `src/scene/BatikTextures.ts` |
| Tiles get batik on top face | DONE | All 100 tiles have the per-region batik on the top face, solid color on the sides for depth. Number labels got a translucent backing so they stay readable over the pattern |
| Pion costumes | DONE | Each of 4 pions wears a distinct batik costume (Player=parang, Bot Ulos=ulos, Bot Batik=poleng, Bot Songket=kawung). `PionSpec.costume` is the new constructor arg; falls back to solid color if absent |
| Win modal batik background | DONE | Win card has a batik background-image (parang pattern) at 35% opacity, applied via CSS variable `--win-batik-url` set at game-over time |
| Win-sweep camera | DONE | Existing `win-sweep` mode in `CameraController` wired to game-over. 6-second orbital around the winner's pion position, smooth y-descent. Bug found during verification: easeInOutCubic was freezing the orbit at the start (cubic curve = 0 at t=0). Fix: linear easing so the orbit is visible from t=0; the orbital motion is the easing. Verified by sampling 12 camera positions over 3 seconds — smooth orbital motion |
| Dice-bounce physics | DONE | Replaced the 800ms flat-spin with a 1100ms parabolic-arc + bounce. Dice rises in a sin arc to peak ~0.9 units, descends, hits the table, bounces once with decay, settles. 4 full rotations (was 3) + lands on correct face. Verified by sampling Y position over the animation: rises to 0.885, descends to -0.149 (compression), settles to 0.000 |

### Files changed in slice 4

- `src/scene/BatikTextures.ts` — NEW, 5 pattern drawers + `makeBatikTexture()` and `makeBatikDataUrl()`
- `src/scene/Geometry.ts` — per-region batik textures applied to tile top faces, number labels got translucent backing
- `src/components/Pion.ts` — added `PionCostume` interface + `costume?` field on `PionSpec`, applied to body+head material
- `src/main.ts` — pion costumes wired (4 distinct batik patterns), cameraController passed to game
- `src/game/Game.ts` — added `cameraController` dep, refactored game-over into `triggerGameOver(p)` that fires event + sets win-sweep + clears save
- `src/scene/CameraController.ts` — win-sweep uses linear easing
- `src/components/Dice.ts` — parabolic Y motion + bounce, 4 full rotations. (Also fixed a `rotación` typo from slice 1 that caused dice rotation to silently always start at 0)
- `index.html` — added `<div class="win-batik">` for the win modal background layer
- `style.css` — added `.win-batik` rules and `--win-batik-url` variable
- `src/ui/Ui.ts` — sets `--win-batik-url` on game-over with a parang data URL

### Slice 4 verification (real, not just compile)

- tsc --noEmit: 0 errors
- vite build: clean, 52KB game bundle (up from 48KB)
- 362 meshes, 100/100 tiles have batik top, 4/4 pions have batik costumes
- Dice bounce: Y trajectory samples over the 1100ms show rise (0.54 → 0.88), fall (0.88 → 0.16), compression (-0.15), settle (0.00)
- Win-sweep: 12 camera samples over 3 seconds show smooth orbital motion (x: -4.22 → -20.50, y: 19.37 → 13.96, z: 11.91 → -6.49)
- simulateMatch: 90 turns, winner = Bot Ulos, 0 errors

### Bugs found and fixed during slice 4 verification

- **Win-sweep frozen at start**: easeInOutCubic flattens to 0 at t=0, so the orbit had no visible motion for the first ~10% of the 6-second sweep. Fixed by switching to linear easing (the orbital motion itself is the easing).
- **Dice rotation always started at 0**: there was a `d.rotación.clone()` typo (Spanish word instead of `rotation`) in slice-1 Dice.ts. TypeScript's permissive type-checking let it through, but at runtime the rotation was undefined. The dice animation visually worked because we overwrote the rotation every frame. Fixed by writing `d.rotation.clone()`.

### Slice 4 backlog (still parked)

- Audio (CC0/BY gamelan loop + SFX)
- Trivia scaffolding (deferred to v2 per kickoff Q&A)
- Pion costume customization UI (let players pick from the 5 batik patterns instead of the hard-coded assignment)
- i18n (English/Indonesian)
- PWA / offline
- Headless test harness (proper Vitest/Jest setup so we can run simulateMatch in CI)

## Slice 5 changelog (2026-06-15) — overlap-fix polish

User feedback: the dice (at center, y=0.6) was occluded by snake tubes passing through the center, and number labels were hard to read against the busy batik + snake-tube backgrounds. Three targeted fixes.

### What was delivered

| Issue | Fix | Approach |
|---|---|---|
| Snake tubes pass through the dice area | Snakes route around the dice | Two-stage defense: (1) push snake control points out of a 0.9-radius keep-out zone, (2) post-process the final tube geometry to guarantee every vertex respects the keep-out (CatmullRomCurve3 can dip inward between control points, so stage 1 alone isn't enough) |
| Dice sits below snake arc peak | Dice lifted above snakes | Y position from 0.6 → 1.5, above the typical snake peak (~1.15). Bounce animation still works (it uses the dice's current Y as the baseline) |
| Number labels hard to read | Larger, outlined label backing | Canvas 64→96, backing 24→38 radius, font 28→36px, added 2px outline for contrast, plane 0.7→0.95 × TILE_SIZE. Reads cleanly over both batik and snake-tube shadows |

### Files changed in slice 5

- `src/components/Snake.ts` — added `DICE_KEEPOUT_RADIUS` constant + `applyDiceKeepout()` + `clampTubeToKeepout()`. Also fixed a third `rotación` typo in `addNumberLabel`'s sibling code (labelMesh.rotation, was labelMesh.rotación — but that one is in Geometry.ts not Snake.ts)
- `src/main.ts` — dice rest position 0.6 → 1.5
- `src/scene/Geometry.ts` — number labels: larger canvas, larger backing, larger font, outlined

### Slice 5 verification (real, not just compile)

- tsc --noEmit: 0 errors
- vite build: clean, 52KB game bundle
- Snake min-distance-to-origin check: BEFORE the fix, 5 snakes had tube vertices within 0.30-0.80 of origin (Lipan, Ular Kadal, Ular Naga Jawa, Buaya Putih, Naga Tasik). AFTER the fix, ALL 9 snakes have their nearest tube vertex ≥ 0.97 from origin. The keep-out works.
- Dice Y: 1.5 at rest, ~2.4 at bounce peak. Snake arc peak: ~1.15. Clearance at rest: 0.35 units. Clearance at bounce: 1.25 units. No overlap.
- simulateMatch: 58 turns, 0 errors
- Number labels: bigger backing + outline + larger font makes them readable over both batik and snake shadows

### Bug found during slice 5 verification

- **Initial control-point-only fix was insufficient**: stage 1 (push control points) was enough on paper, but `CatmullRomCurve3` interpolates between control points and can dip toward the origin between widely-spaced points. Lipan, with 14 segments, was hitting 0.30 from origin even with stage 1. Fix: stage 2, post-process the actual tube vertex positions.

### Slice 5+ backlog (still parked)

- Audio (CC0/BY gamelan loop + SFX)
- Trivia scaffolding (deferred to v2 per kickoff Q&A)
- Pion costume customization UI
- i18n (English/Indonesian)
- PWA / offline
- Headless test harness (Vitest)

## Slice 6 changelog (2026-06-15) — player engagement features

Slice 6 adds three kid-facing features that complete the "this is a real game" feel: a player costume picker, procedural SFX, and a trivia popup on ladder landings.

### What was delivered

| Feature | Status | Notes |
|---|---|---|
| Pion costume picker | DONE | 5 batik patterns (parang/ulos/kawung/poleng/ukir) with color variants, selected from the main menu. Player's choice persists across resume. Bots keep their assigned costumes (ulos/poleng/kawung). Each pick re-textures the player pion at runtime via `Pion.setCostume()` |
| Procedural SFX | DONE | All sounds synthesized with Web Audio API — no audio files, no licensing. 5 effects: dice-rolled (filtered noise), snake (descending saw sweep), ladder (rising pentatonic chime), win (major arpeggio), lock (sine pulse). Mute toggle in the dice area. Audio context lazily created on first user gesture |
| Trivia popup | DONE | When a human player lands on a ladder, a popup shows a question about the monument (e.g. "What is the gold flame on top of Monas symbolizing?"). 7 monuments × 2-3 questions each. Correct answer → green highlight + "Benar! 🎉" + fun fact. Wrong → red highlight + "Hampir!" + correct fact. Bots skip trivia (they don't need to learn) |

### Files changed in slice 6

- `index.html` — added costume-picker section to menu, audio-toggle button, trivia modal
- `style.css` — costume-picker buttons, costume-swatch CSS patterns (parang/ulos/kawung/poleng/ukir), audio-toggle button, trivia-card styles
- `src/scene/BatikTextures.ts` — added `PionCostumeSpec` + `PATTERN_VARIANTS` (each pattern has 2-3 color variants) + `getPionCostume()` helper
- `src/components/Pion.ts` — added `setCostume()` method for runtime texture swap
- `src/audio/AudioEngine.ts` — NEW. `AudioEngine` class with 5 SFX, master gain, mute
- `src/game/Trivia.ts` — NEW. 18 questions across 7 monuments, `getTrivia(monumentName)` + `getTriviaForLadder()`
- `src/game/EventBus.ts` — added `trivia-show`, `trivia-answer`, `trivia-hide` events
- `src/game/Game.ts` — `newMatch()` now takes a playerCostume, `getPlayerCostume()` accessor, `playerCostume` field
- `src/game/SaveLoad.ts` — `playerCostume` field in save schema v1, restored on resume, fallback to 'parang' for old saves
- `src/ui/Ui.ts` — costume-button event handlers, trivia show/hide/answer methods, trivia event listener, ladder event fires trivia-show for human players only
- `src/main.ts` — AudioEngine instantiation, audio toggle wiring, SFX-to-event-bus mapping, Pion.setCostume call on newMatch + resume
- `src/components/Pion.ts` — setCostume method (covered above)

### Slice 6 verification (real, not just compile)

- tsc --noEmit: 0 errors
- vite build: clean, 63KB game bundle (up from 52KB)
- Pion picker: 5 costume buttons in the menu, clicking Kawung updates the player pion's texture to kawung (verified by reading playerPion's body material map)
- Audio: 4 SFX event handlers wired (dice-rolled, snake, ladder, game-over), all 4 fired correctly when bus.emit() was called
- Trivia popup: shows question for Candi Borobudur, picks correct answer → "Benar! 🎉" + fact, picks wrong answer → "Hampir!" + correct fact
- simulateMatch: 22 turns, winner = Bot Ulos, 0 errors

### Slice 6 design decisions

- **Procedural audio, not recorded**: Tracked CC0 gamelan sources (Pixabay, Internet Archive, Smithsonian) but they all have licensing complications or unstable CDN URLs. Procedural Web Audio SFX is smaller (zero bytes for the audio), license-free, and tunable. No music track added — punted to slice 7 if you want a real song
- **Trivia only for human players**: Bots are AI; they don't need to learn. Pop the question only when the human lands on a ladder
- **Trivia doesn't pause the game**: The pion climb animation is 1.4s, the user takes longer to answer. The trivia modal sits on top while the climb happens underneath. After answering, the next turn proceeds normally
- **Multiple questions per monument**: 2-3 questions each so a player who lands on the same ladder multiple times gets a fresh question
- **Player costume persisted in save**: `playerCostume` is saved with the match state, so resume restores the chosen costume

### Slice 6+ backlog (still parked)

- Trivia for snakes (currently only ladders get questions) — could add a "what does this creature symbolize?" question
- PWA / offline
- i18n (English/Indonesian)
- Background music (procedurally generated gamelan-style loop or skip entirely)
- Headless test harness (Vitest)
