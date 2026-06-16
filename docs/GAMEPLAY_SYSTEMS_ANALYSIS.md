# Gameplay systems analysis

**Generated:** 2026-04-20  
**Method:** Full parity pass against [docs/gameplay/GAMEPLAY_MECHANICS_CATALOG.md](gameplay/GAMEPLAY_MECHANICS_CATALOG.md) (§1–14, Appendices A–D vs `contracts.ts`), plus codebase exploration (`game.ts`, `useAppStore.ts`, `floor-mutator-schedule.ts`, `mechanics-encyclopedia.ts`).

This document maps **what exists today**, **how pieces connect**, and **where gameplay is incomplete or split between “rules” and “presentation.”** It is meant to support a **fully refined** mechanical design—not to replace `GAME_MECHANICS_IDEAS.md` (backlog) or `MUTATORS.md` (mutator checklist).

---

## 1. Executive summary

The project has a **strong shared rules layer** (`src/shared/game.ts` + `contracts.ts`): memory phase, pair matching, scoring, lives, many powers (shuffle, destroy, peek, undo, pins, stray remove, gambit, wild/decoy paths, etc.), contracts, relic-adjacent hooks, and extensive unit tests.

The **desktop renderer** (`GameScreen`, `TileBoard`, Zustand `useAppStore`) is **correctly wired** to that layer for turns: tile presses and toolbar actions call pure `game.ts` functions and update `run` in the store. **Electron IPC does not drive turns**; it handles settings, save/load, achievements, display, Steam—appropriate for a local rules engine.

**Documentation chain:** Hand-maintained [GAMEPLAY_MECHANICS_CATALOG.md](gameplay/GAMEPLAY_MECHANICS_CATALOG.md) maps mechanisms and **every** `RunState` / `Tile` field to epics; [GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md](gameplay/GAMEPLAY_MECHANICS_CATALOG.auto-appendix.md) is regenerated via `yarn docs:mechanics-appendix` for version counters. Player-facing Codex copy is **`mechanics-encyclopedia.ts`** (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

**Remaining polish** (smaller):

- **Symbol band rotation** (`tile-symbol-catalog.ts`): confirm per-level curve when balancing.

**Viewport shell:** `GameScreen` sets `cameraViewportMode` from the same compact breakpoint as the rest of the HUD (`width` / `height` vs `VIEWPORT_MOBILE_MAX`), so wide desktop windows use the non–mobile-camera layout; small windows use the mobile camera shell. **`TileBoard`** still enables mouse wheel / drag pan and zoom carry-forward on wide viewports via `desktopCameraMode` + `renderedViewportState` / viewport `useEffect` (see `TileBoard.tsx`); the **Fit board** toolbar control is always shown so desktop zoom can be reset.

**Addressed in recent refinements:** `wide_recall` / `silhouette_twist` / `distraction_channel` apply **flat per-match score penalties** in `game.ts` (`getPresentationMutatorMatchPenalty`) plus renderer styling (including **WebGL face tints** for `wide_recall` / `silhouette_twist` / `n_back_anchor`); **gauntlet** auto–game over via store interval, **5/10/15m** menu presets, and **`gauntletSessionDurationMs`** for restart fidelity; **`RunState.distractionTick` removed**—distraction HUD numeric tick is **local React state** in `GameScreen` only; **README** lists run types; **focus-assist dimming** is applied in both **2D fallback and `TileBoardScene`** (`dimmedTileIds`); **procedural Web Audio SFX** on flip + resolve (`src/renderer/audio/gameSfx.ts`); **puzzle JSON import** via `parsePuzzleImportJson` + store; **WebGL tutorial pair badges** on hidden backs (`TutorialPairMarkerPlane`).

---

## 2. Architecture (who owns what)

| Layer | Responsibility | Gameplay role |
|--------|----------------|----------------|
| **`src/shared/game.ts`** | Pure `RunState` transitions | Source of truth for matches, scoring, level advance, game over (rules). |
| **`src/shared/contracts.ts`** | Types, settings shapes | Declares mutator IDs, modes, fields—some fields are **ahead of** full rule use. |
| **`src/shared/mutators.ts`** | Catalog copy, `hasMutator`, daily table | **Metadata**; behavior lives in `game.ts` branches + renderer. |
| **`src/shared/floor-mutator-schedule.ts`** | Endless per-floor mutator rotation | Injects mutator **lists**; effect still requires `game.ts` / UI implementation. |
| **`src/renderer/store/useAppStore.ts`** | `run`, timers, `pressTile`, powers | **Orchestration**: calls `game.ts`, schedules memorize/resolve timers, applies `gameOver` / `levelComplete` via `applyResolvedRun`. |
| **`GameScreen` / `TileBoard`** | Input, layout, 3D/DOM, mutator **presentation** | Not authoritative for rules; must stay in sync with `game.ts`. |
| **Electron main/preload** | IPC | **No** live board protocol; persistence and shell only. |

---

## 3. Core loop (shared rules)

**Phases:** `memorize` → `playing` → (optional) `resolving` → back to `playing`, or `levelComplete` / `gameOver` / `paused`.

**Typical flow:**

1. Run starts in **`memorize`** with `timerState.memorizeRemainingMs` (duration can depend on level, mutators such as `short_memorize`, relic-related helpers).
2. **`finishMemorizePhase`** moves to **`playing`**.
3. **`flipTile`** updates `flippedTileIds`, respects special cases (e.g. `sticky_fingers`, gambit allowing a third flip, clearing flash-pair reveal state).
4. Two (or three with gambit) flipped tiles → **`resolving`** with optional delay (`resolveRemainingMs`).
5. **`resolveBoardTurn`** applies match/mismatch, life changes, contract caps, spotlight rotation, findables, etc., then returns to **`playing`** or terminal states.
6. Board cleared → **`finalizeLevel`** → **`levelComplete`**; **`advanceToNextLevel`** rebuilds board and can apply **endless floor schedule** mutators.

**Win / lose (rules):**

- **Floor clear:** all tiles `matched` or `removed`.
- **Lose:** `lives` to 0 (mismatches, parasite drain on advance, etc.), or contract `maxMismatches` forcing loss.

**Gauntlet time limit:** `isGauntletExpired` in `game.ts` is used by the store on **`pressTile`** and by a **`useAppStore` subscription** that (while an active gauntlet run is in gameplay view) starts a **`setInterval` ~every 300ms**—the subscription itself runs on **every** state change; the interval callback checks `Date.now()` vs `gauntletDeadlineMs` and then **`applyResolvedRun`** can set **`gameOver`** (same path as tile expiry). The HUD still updates from `GameScreen` local timer for display.

---

## 4. Modes and run creation

Runs are constructed in **`game.ts`** via factories such as `createNewRun`, `createDailyRun`, `createGauntletRun`, `createPuzzleRun`, `createMeditationRun`, etc., then often **`patchRunFromUserSettings`**.

**Endless (`floor-mutator-schedule.ts`):** deterministic cycle of mutators + `floorTag` (`normal`, `breather`, `boss`), with a seeded chance to append **`distraction_channel`** on some boss floors.

**README** now summarizes run types (endless/classic, daily, gauntlet, puzzle, meditation, featured runs) and links to this doc and `MUTATORS.md`.

---

## 5. Powers and meta-actions (store + UI)

Wired through **`useAppStore`** and **`GameScreen`** / toolbar:

- **Tiles:** normal flip, pin mode (`togglePinnedTile`), stray remove, peek, destroy pair (with resolve/terminal handling).
- **Shuffle:** full board (`applyShuffle`) and row/region (`applyRegionShuffle`), often coordinated with **`TileBoard`** shuffle animation callback.
- **Resolving:** undo flip (`cancelResolvingWithUndo`), timers for resolve delay.
- **Pause, level complete continue, relic pick modals, abandon run**, etc.

**Encore scoring:** `resolveBoardTurn` can take **`encorePairKeys`** from save meta (`saveData.playerStats?.encorePairKeysLastRun`); the list is **external** to the pure board, not computed inside `game.ts`.

---

## 6. Mutators: implementation matrix

| Mutator ID | Scheduled (daily / endless) | **Rules in `game.ts`** | **Renderer / presentation** |
|------------|-----------------------------|-------------------------|-------------------------------|
| `short_memorize` | Daily table | Yes (duration / synergies) | HUD labels |
| `glass_floor` | Cycle | Yes (decoy tile) | Board shows decoy behavior via state |
| `category_letters` | Cycle | Yes (symbol set) | Faces show letters |
| `sticky_fingers` | Cycle | Yes (first-flip block) | UX feedback |
| `findables_floor` | Catalog / modes | Yes (placement, scoring) | Faces / labels |
| `shifting_spotlight` | Catalog / modes | Yes (ward/bounty rotation) | Tests + logic |
| `score_parasite` | Cycle | Yes (life drain on advance) | Run stats |
| `n_back_anchor` | Cycle | Yes (`nBackAnchorPairKey` updates) | Optional HUD |
| `wide_recall` | Endless cycle | Yes: **flat per-match penalty** (`getPresentationMutatorMatchPenalty`) | **CSS + WebGL:** de-emphasizes symbol when flipped (`wideRecallInPlay`); `TileBoardScene` face tints parity; not a wider grid in `buildBoard` |
| `silhouette_twist` | Endless cycle | Yes: **flat per-match penalty** | **CSS + WebGL** `silhouetteFace` / material parity on faces during play |
| `distraction_channel` | Sometimes appended on boss floors | Yes: **flat per-match penalty** while mutator active | **Local React HUD** in `GameScreen` (numeric overlay; gated by settings / reduced motion) |

**Takeaway:** Those three IDs combine **rules-level match score pressure** with **presentation**; see `MUTATORS.md` and `GAME_RULES_VERSION` in `contracts.ts` for semantics.

**`mutators.ts`:** `DAILY_MUTATOR_TABLE` is a **subset** of all shipped mutator IDs; other mutators appear in endless schedule or other run factories.

**`wide_recall` scope:** Rules + catalog describe **label-first / de-emphasized symbols on flipped tiles** in `TileBoard` / `TileBoardScene`; there is **no** wider grid or extra columns from `buildBoard`.

---

## 7. Renderer wiring (connection health)

**Healthy connections:**

- **`pressTile`** gates on `view === 'playing'`, gauntlet expiry, then delegates to the correct `game.ts` API. Normal flips require `run.status === 'playing'`; the **gambit third pick** path can call `flipTile` while `run.status === 'resolving'` (two tiles already flipped).
- **Terminal states** funnel through **`applyResolvedRun`** (achievements, save, flow to level complete / game over).
- **3D path:** R3F `Canvas` + `TileBoardScene` + `tileTextures` (programmatic faces for digit motifs, canvas overlays).
- **2D fallback:** DOM grid buttons; same store actions.

**Presentation note (distraction HUD):** The distraction-channel overlay uses **`useDistractionChannelTick`** in [`GameScreen.tsx`](../src/renderer/components/GameScreen.tsx)—**by design** local UI state only (match penalties live in `game.ts` on `RunState.activeMutators`).

---

## 8. Symbol catalog and relics

- **`tile-symbol-catalog.ts`:** `getSymbolSetForLevel` / `getSymbolSetIndexForLevel` rotate **number → letter → callsign** bands by floor bracket (`SYMBOL_BAND_LAST_LEVEL_NUMERIC` / `SYMBOL_BAND_LAST_LEVEL_LETTER`; currently 1–8 / 9–16 / 17+); `category_letters` still forces the letter band for generation.
- **Some relic hooks** are partial: e.g. immediate apply no-ops where the real effect is folded into **`getMemorizeDurationForRun`** or floor flags—**not wrong**, but easy to misread as “missing.”

---

## 9. Persistence, Steam, tests

- **Save** normalizes and stores progress/settings; **game rules** do not require network.
- **Rules tests (`game.test.ts`):** broad coverage (memorize, resolve, scoring, shuffle, pins, destroy, findables, spotlight, advance, etc.). **Gambit miss + contract:** a resolved three-flip miss increments tries with `GAMBIT_FAIL_EXTRA_TRIES` and can trip **`maxMismatches`** (`resolveGambitThree` in `game.ts`), including **`maxMismatches: 0`** with floor tries still at zero. **Wild + contracts:** `createWildRun` harness asserts **`noDestroy`** blocks **`applyDestroyPair`** and **`noShuffle`** blocks **`canShuffleBoard` / `applyShuffle`** on a real wild board. **Gambit three-flip** (match path), **`maxMismatches`**, **`noShuffle` / `noDestroy` / `maxPinsTotalRun`**, and **`isGauntletExpired`** are covered. **Stacking:** `describe('relic and mutator stacking')` asserts `getMemorizeDurationForRun` with `short_memorize` plus `memorize_under_short_memorize` / `memorize_bonus_ms`; **`active contract limits`** covers `maxMismatches` with presentation mutators, presentation match penalty with strict contracts, `noShuffle` / `noDestroy` with presentation mutators (including **row / region shuffle** vs full-board shuffle), and an **`it.each`** matrix for the four **`noShuffle` × `noDestroy`** combinations vs **`canShuffleBoard`** / **`applyDestroyPair`**. **`noShuffle` still wins over relic shuffle economy** (extra charges, first free full-board shuffle per floor, or **`region_shuffle_free_first`** with zero paid region charges). **`noDestroy` still blocks destroy** with **`destroy_bank_plus_one`** banked charges. **`noShuffle` + `noDestroy` together** still block full-board shuffle, row shuffle, and destroy when relics grant charges. **`maxPinsTotalRun`** caps pins with presentation mutators active. [`tile-symbol-catalog.test.ts`](../src/shared/tile-symbol-catalog.test.ts) includes a level-17 `buildBoard` smoke check for the callsign band.
- **Current power coverage addendum:** the active contract and board-power tests now cover tile swap alongside full-board shuffle, row shuffle, and destroy. `noShuffle` blocks tile swap even when row/swap relic economy grants free or paid charges.
- **Store + e2e:** [`useAppStore.test.ts`](../src/renderer/store/useAppStore.test.ts) covers **`startScholarContractRun`** (`shuffleBoard` / `shuffleRegionRow` / `toggleTileSwapArmed` / armed destroy + `pressTile` as no-ops under **`noShuffle` + `noDestroy`**), **`restartRun`** preserving the scholar **`activeContract`**, and gauntlet deadline handling without a tile press. Playwright [`e2e/scholar-contract.spec.ts`](../e2e/scholar-contract.spec.ts) smoke-clicks **Scholar** from the main menu and asserts the gameplay HUD shell.
- **`mutators.ts`:** light **`mutators.test.ts`** (catalog / `hasMutator` / daily table); full behavior remains in **`game.test.ts`**. **`puzzle-import.test.ts`** covers JSON puzzle validation.

---

## 10. Recommendations toward “fully refined gameplay”

1. **Mutator contract:** Keep `MUTATORS.md` and catalog text aligned with **`game.ts` + renderer** (ongoing).
2. **Next polish:** Optional high-value **e2e** for board flows; `tile-symbol-catalog` / numeric balance per [BALANCE_NOTES.md](./BALANCE_NOTES.md). Common **relic + mutator** and **contract + presentation mutator** paths are covered in `game.test.ts`; expand only if your release bar needs a fuller contract permutation suite.

---

## 11. Key file index

| Area | Files |
|------|--------|
| Rules engine | `src/shared/game.ts`, `src/shared/contracts.ts` |
| Run history / share key | `src/shared/run-history.ts` — `buildRunShareKey`, `buildRunHistoryExportString`; share keys are seed/rules/mode summaries, not replay/import payloads |
| Run factories / summaries | `game.ts` — `createNewRun`, `createDailyRun`, `createGauntletRun`, `createPuzzleRun`, `createRunSummary`, … |
| Mutators metadata | `src/shared/mutators.ts`, `src/shared/floor-mutator-schedule.ts` |
| Store / turns | `src/renderer/store/useAppStore.ts` |
| Play UI | `src/renderer/components/GameScreen.tsx`, `TileBoard.tsx`, `TileBoardScene.tsx` |
| Visuals | `tileTextures.ts`, `programmaticCardFace.ts`, `TileBoard.module.css` |
| Design docs | `docs/GAME_MECHANICS_IDEAS.md`, `docs/MUTATORS.md` |
| Tests | `src/shared/game.test.ts`, `mutators.test.ts`, `puzzle-import.test.ts`, `src/renderer/store/useAppStore.test.ts`, `e2e/` |

---

*End of analysis.*
