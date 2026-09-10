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

**Addressed in recent refinements:** `wide_recall` / `silhouette_twist` / `distraction_channel` apply **flat per-match score penalties** in `game.ts` (`getPresentationMutatorMatchPenalty`) plus renderer styling (including **WebGL face tints** for `wide_recall` / `silhouette_twist` / `n_back_anchor`); **gauntlet** auto–game over via store interval, **5/10/15m** menu presets, and **`gauntletSessionDurationMs`** for restart fidelity; **`RunState.distractionTick` removed**—distraction HUD numeric tick is **local React state** in `GameScreen` only; **README** lists run types; **focus-assist dimming** is applied in both **2D fallback and `TileBoardScene`** (`dimmedTileIds`); **procedural Web Audio SFX** on flip + resolve (`src/renderer/audio/gameSfx.ts`); **authored puzzle payload validation** for builtins and future tooling (no menu JSON importer in this build); **WebGL tutorial pair badges** on hidden backs (`TutorialPairMarkerPlane`).

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

## Gen 194: how much of the game anything actually watches

The interaction graph declares **45 mechanics**. The occupancy census watches **7 counters**. Until
this generation nothing joined the two, and that gap is where this repository's most expensive
failures have lived:

- the pop shipped dead for six floors (Gen 148),
- the ripple went from 7% of breaks to zero and stayed there for three generations (Gen 190–192),
- the magpie takes back pairs the player has already cleared, on every fourth miss, on every floor,
  with no counter, no graph node and no test that it has ever happened in a real run.

None of those were bugs a unit test could catch. Every one of them had passing tests, because a
fixture is built to make its rule fire - which is exactly what hides a rule that never fires on a
board the generator actually deals.

`yarn audit:mechanic-accountability` now walks the graph and asks three questions of every mechanic:
does something count it, does its evidence exist, does it carry tests that exist. It is in
`gate:systems`, so a new mechanic cannot ship without answering and a mechanic whose module is
deleted cannot linger.

### What it says today

| | Mechanics |
|---|---|
| Censused by a `RunState` counter | 7 |
| Exempt, with a written reason | 38 |
| Unanswered | 0 |

Zero unanswered is the gate passing, not the game being well watched. **Seven of forty-five** is the
real number, and the exemption list is the worklist. Twenty-six of the thirty-eight are invisible
for one reason:

> The census plays real generated floors, but the thing playing them only ever flips pairs. It never
> spends a charge, never arms a power, never reads a trait. So all eleven powers, all eleven
> inventory charges and all four traits are invisible - not because the game lacks them, but because
> the reference player does not use them.

That is one fix, not twenty-six: a census player that spends what it is given. It is the next
generation of this work.

The other twelve are exempt for reasons that will not go away by trying harder. Some are frames the
census itself drives (`progression.run_flow`), some are chosen before a floor exists
(`progression.run_setup`, `mode.wild_run`, `board.wild_joker_tile`), some are guarantees rather than
occurrences (`safety.softlock_fairness`, whose proof is the softlock seed sweep), and two are tools
for measuring the game rather than rules inside it. Those stay exempt and say so.

## Gen 195: the census player picks up its tools

Gen 194 measured that 26 of the 45 mechanics were invisible for one reason: the thing playing the
census only ever flipped pairs. This generation gives it a policy for spending what a plain endless
run hands it, and moves eight mechanics off the exemption list.

| | Gen 194 | Gen 195 |
|---|---|---|
| Censused | 7 | **15** |
| Exempt, with a reason | 38 | 30 |
| Unanswered | 0 | 0 |

### Two passes, not one

The tooled player is a **second pass** over the same floors. A shuffled board pops differently, and
the cascade counters are ratcheted against a baseline that means something; measuring both from one
run would have quietly moved that baseline to describe a player who shuffles. So the reference pass
plays as it always did and the tooled pass plays beside it.

### A charge is not a tally, and its endpoints are not a spend

Counters now have a kind. A `tally` counts up as something happens. A `spend` counts *down*: a
charge whose fall is what the player pressed. That distinction already existed as a rule against
censusing "undos remaining" at all - reading a charge's value as an occurrence reports that the
charge exists, not that anyone used it.

The first implementation took the spend as the difference between the floor's opening and closing
charge, and the peek measured as **silent on all 240 floors** while working perfectly. Two separate
mistakes, both worth keeping:

1. The opening snapshot was taken from a tooled build, so any tool spent before the first turn had
   already been spent in the reading it was being compared against. Every opening spend read zero.
2. Fixing that took the peek to 0.492, which was the second mistake: **the Echo trait hands peek
   charges back**. A charge that can be refilled mid-floor is not measurable from its endpoints - a
   floor where one peek was spent and another earned reads as no peek at all.

Spends are now summed as they happen: every fall in a watched charge is added as the run state moves
through it. A fall that happened is still a fall, whatever the trait gives back afterwards. This is
still reading the game's own ledger rather than remembering what the census pressed.

### What the tools read

| Tool | Floors | Reading |
|---|---|---|
| Peek | 1.000 | Usable on every floor |
| A row shuffled | 0.983 | |
| The board shuffled | 0.975 | The rest have too few hidden pairs left by the time it is tried |
| Undo | 0.558 | Spent on a miss, and the reference miss rate does not make one every floor |

A `tools` row reads differently from the rest of the census: the tooled player presses everything it
is given, so the number is how often the power was **usable**, not how often a real player would
reach for it. Read them as reachability.

### What is still blind

Eighteen mechanics: the seven powers a plain endless run never grants - Destroy, Stray Remove, Flash
Pair, the pin, the gambit, the tile swap and the wild match all start at zero and come from a run
setup - their seven charges, and the four traits, which pay on a match that touches them where the
census player picks pairs without reading them. Both are a census that plays a *setup*, not a plain
floor, which is the next step.

## Gen 199 — every system in the game answers for itself

The directive was "refine every system in the game", and the first honest thing to do with it was to
find out how many there are and which of them can be observed at all. The answer, from
`scripts/mechanic-accountability.ts` joined to the occupancy census:

| | Mechanics | Censused | Exempt, with a reason | **Unaccounted** |
|---|---|---|---|---|
| Gen 194 (the audit shipped) | 45 | 7 | 12 | 26 |
| Gen 195 (the census spends its tools) | 45 | 15 | 12 | 18 |
| **Gen 199** | **45** | **32** | **13** | **0** |

Every mechanic in the game now either has a counter that moved on real generated floors, or an
individually argued line saying why it cannot have one. Nothing is excused by family.

### What was blocking it

A blanket blind-spot list. Three prefixes — `power.`, `inventory.`, `trait.` — excused eighteen
mechanics on the grounds that "the census player never spends a charge or arms a power". That is a
statement about the census, not about the game: it is a debt register wearing an exemption list's
clothes, and it had been growing quietly since Gen 194.

Gen 199 pays it off with a third census pass. The `setup` player starts from a run setup rather than
a plain endless run, so the wild joker is on the board and Stray, Flash, the pin, the tile swap, the
gambit's third flip and the wild match token are all there to be spent. It presses them the way the
tooled player presses its own: the least interesting policy that still touches every button.

`REFERENCE_PLAYER_BLIND` is now an empty list. The mechanism stays because the next family may earn
one; the empty list is easier to defend than a missing one.

### What the census found the moment it could see

Three things, none of which any test had caught, which is the argument for the whole exercise.

**Destroy is unreachable.** `destroyPairCharges` is created at 0 in `run-creation-rules.ts`, and
every other reference in the codebase decrements or reads it. No code path grants one. The power has
an action, an availability rule, a targeting preview, a disabled-reason string, player copy, a Codex
entry and a card-back accent — and a player can never press it. It is recorded as UNREACHABLE rather
than exempt, and it is left for a design call rather than removed unilaterally: either a setup grants
the charge, or Destroy goes the way of the decoy. What it must not do is stay as it is, which is a
mechanic zeroed rather than removed — the exact shape `REMOVED_DECOY.md` was written about.

**Stray and the wild match compete for the same card, always.** Stray takes a completion-safe
singleton; after Gen 196 removed the decoy and the exit key, the wild joker is the only singleton
left in the game. So a run that spends its stray has thrown away its wild match, and one that keeps
the joker has nothing to stray. The census cannot see both on one floor, so it alternates — even
floors take the stray, odd floors match the joker — and the trade is on the record instead of hidden
inside whichever one the census happened to press first. It is a real design question: two powers
that cannot both be used is either a deliberate choice or an accident of the decoy's removal, and
nobody has decided which.

**Two cadences were wrong, and the first measurement corrected them.** The gambit was filed `core`
and measures 0.400 — it is spent on a miss, and the reference miss rate does not produce one on
every floor, which is the undo's shape for the same reason. The four traits were filed `rare` and
measure 0.379 to 0.550; four traits spread over a floor's tiles is not an occasional event. Both are
now `common`. Guessing a cadence and letting the census correct it is the intended workflow; the
mistake would have been to widen the band instead.

### The census as it now reads

| Cadence | Systems |
|---|---|
| core (≥0.90) | chunk breaks, recall matches, turn resolutions, pickups, peek, shuffle, row shuffle, flash, tile swap, pin |
| common (0.10–0.90) | Fever breaks, the drop, mismatches, undo, gambit, stray, wild match, and the four traits |
| exempt (13) | the command bus, the HUD, the memorize phase, run flow, run setup loadouts, the featured streak, the run summary, softlock fairness, the two simulation tools, and Destroy with its charge (unreachable) |

`yarn sim:occupancy --check` bands every row and `audit:mechanic-accountability` fails if a mechanic
appears in the graph with neither a counter nor a reason, so the next mechanic added to this game
cannot land unmeasured without the gate saying so by name.
