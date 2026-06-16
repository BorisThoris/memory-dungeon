# Gameplay polish, gaps, and partial implementations

**Purpose:** One **consolidated** view of mechanics that are **incomplete**, **presentation-light**, **documentation-risky**, or **need product polish**—without duplicating full epic writeups. For implementation detail and code pointers, follow the linked epics.

**Actionable tasks:** Each gameplay epic has a **## Tasks (polish backlog)** section; items are checked off in epics with *resolution notes* where work was deferred to v2 or left as ongoing process (see epic **Backlog closure** lines, 2026-04-17). Update narrative rows below when mechanics change.

**Maintenance:** When an item is fixed or superseded, update this file **and** the relevant epic’s **Rough edges** / **Refinement** section so they stay aligned.

**Related:** [GAMEPLAY_MECHANICS_CATALOG.md](./GAMEPLAY_MECHANICS_CATALOG.md) (what exists; Appendices A–D match `contracts.ts` including **`Tile`** fields), [GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md) (architecture + recommendations).

---

## Legend

| Tag | Meaning |
|-----|---------|
| **Partial** | Rules or shell work; a promised surface (often 3D/visual/copy) is not fully delivered. |
| **Functional** | Correct enough to ship; thin UX, tuning, or scope limits remain. |
| **Risky** | Comment, contract, or player expectation can drift from behavior—doc or UI fix needed. |
| **Unverified** | Not proven end-to-end in this repo’s docs pass (e.g. host integration). |

---

## 1. Presentation mutators vs WebGL board

**Theme:** Several mutators apply **score penalties** (and sometimes HUD) but do **not** fully express “read the card differently” on the **3D** path.

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| `wide_recall` | **Functional** | Penalty in sim; `GameScreen` → `TileBoard` → `TileBoardScene` with cooler face tint during play (`presentationWideRecall`). Not necessarily 1:1 with any legacy DOM-only styling. | [epic-board-rendering-assists](./epic-board-rendering-assists.md), [epic-mutators](./epic-mutators.md) |
| `silhouette_twist` | **Functional** | Same stack; darker face read (`presentationSilhouette`). | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |
| `n_back_anchor` | **Functional** | Simulation + HUD; WebGL **cyan forward read** on anchor tiles (`presentationNBackAnchor`). | [epic-board-rendering-assists](./epic-board-rendering-assists.md), [epic-mutators](./epic-mutators.md) |
| Dead / misleading props | **Functional** | Presentation mutator props are forwarded; keep [epic-board-rendering-assists](./epic-board-rendering-assists.md) audit current when adding new props. | [epic-board-rendering-assists](./epic-board-rendering-assists.md) |

**Scoring side effect:** Presentation mutator **penalties** apply in sim; 3D **tints** now reflect mutator identity for the main presentation trio—still verify copy vs feel ([epic-scoring-objectives](./epic-scoring-objectives.md)).

---

## 2. Core loop & contracts (sim vs types)

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| `wildTileId` on `RunState` | **Functional** | Set from the board whenever a wild tile is spawned (`getWildTileIdFromBoard`); null when absent. Simulation still keys off `pairKey` / `WILD_PAIR_KEY`. | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Fixed / puzzle `fixedTiles` boards | **Functional** | Built-in puzzles are layout-only tile lists unless a caller wires extra init (cursed pair, shifting spotlight seeds, etc.); see [`builtin-puzzles.ts`](../../src/shared/builtin-puzzles.ts) header and [PUZZLE_CONTRIBUTING.md](../PUZZLE_CONTRIBUTING.md). User JSON import validates pairs only. | [epic-core-memory-loop](./epic-core-memory-loop.md) |
| Gambit vs echo timing | **Functional** | Mismatch **resolve delay** differs 2-flip vs 3-flip (echo-aware vs not)—no bug flagged; revisit if balance changes. | [epic-core-memory-loop](./epic-core-memory-loop.md) |

---

## 3. Powers, achievements, and “what counts as a power”

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| `powersUsedThisRun` vs contract comment | **Functional** | Authoritative list lives on [`RunState.powersUsedThisRun`](../../src/shared/contracts.ts) JSDoc (shuffle / row shuffle / tile swap / destroy / peek / undo / gambit / stray / flash / wild match, etc.; pins excluded). **`ACH_PERFECT_CLEAR`** reads this flag—treat UI copy as separate from the type contract. | [epic-powers-and-interactions](./epic-powers-and-interactions.md), [epic-meta-progression](./epic-meta-progression.md) |
| Flash pair | **Functional** | `applyFlashPair` in `game.ts` and `applyFlashPairPower` in `useAppStore` both require practice or wild menu run; toolbar only shows the control in those modes. | [epic-powers-and-interactions](./epic-powers-and-interactions.md) |
| Perfect clear discoverability | **Functional** | Players may not realize undo/peek/gambit disqualify perfect—**UI hint or rename** worth considering. | [epic-meta-progression](./epic-meta-progression.md) |

---

## 4. Meta: telemetry & audio

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Telemetry sink | **Functional** | Privacy-first v1: production default is no-op, dev can log locally, and hosts may inject `setTelemetrySink` for analytics. | [epic-meta-progression](./epic-meta-progression.md) |
| Gameplay audio | **Functional** | Procedural Web Audio SFX on flip + resolve; `masterVolume` / `sfxVolume`. QA per build for packaged autoplay/OS edge cases. | [epic-audio-feedback](./epic-audio-feedback.md), [AUDIO_INTEGRATION.md](../AUDIO_INTEGRATION.md) |

---

## 5. Modes, puzzles, export

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Findables vs **?** decoy | **Functional** | **Findables** = bonus on real pairs (`findableKind`, mutator `findables_floor`). **`?`** on **`glass_floor`** = **singleton decoy** (not a pickup). `isBoardComplete` treats a **hidden** decoy as OK once all other tiles are matched/removed (avoids soft-lock). See [FINDABLES.md](../FINDABLES.md). | [FINDABLES.md](../FINDABLES.md) |
| Puzzle user import | **Functional** | **Import puzzle JSON** (main menu file picker) validates `{ title?, tiles[] }` via `parsePuzzleImportJson` / `startPuzzleRunFromImport`; session cache supports **restart** until reload. Builtins + [PUZZLE_CONTRIBUTING.md](../PUZZLE_CONTRIBUTING.md) remain the authoring pipeline for shipping puzzles. | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Export / import replay | **Functional** | Treat **best-effort** until restart/import paths are unified. | [epic-modes-and-runs](./epic-modes-and-runs.md) |
| Naming: endless vs classic | **Functional** | Code “endless” vs UI “Classic Run” vs locked “Endless Mode”—onboarding hurdle; see catalog. | [epic-modes-and-runs](./epic-modes-and-runs.md), catalog |
| Puzzle library size | **Functional** | Scope limit vs aspiration. | [epic-modes-and-runs](./epic-modes-and-runs.md) |

---

## 6. Session flow, timers, undo

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Timer ownership | **Functional** | Core transitions in `game.ts`; **wall-clock** in store/renderer—debug **desync** as a pair. | [epic-run-session-flow](./epic-run-session-flow.md) |
| Undo UX | **Functional** | Bar shows remaining undos; **spam / failure** modes are sim-defined—verify feel. | [epic-run-session-flow](./epic-run-session-flow.md) |

---

## 7. Scoring & objectives (UX)

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Flip par naming | **Functional** | “Flips” vs “match resolutions”—tooltips/codex could clarify. | [epic-scoring-objectives](./epic-scoring-objectives.md) |
| Communicating taxes | **Functional** | Flip par and shuffle/score tax need clear player-facing explanation. | [epic-scoring-objectives](./epic-scoring-objectives.md) |

---

## 8. Lives, pressure, gauntlet

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Gauntlet | **Functional** | **5 / 10 / 15 minute** menu presets; `gauntletSessionDurationMs` on `RunState` preserves length for **restart**. No extra in-run curve beyond base game. | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |
| Score parasite | **Shippable** | HUD track + **Ward ×N** when ward charges remain; tooltips/aria match life-drain rules (not score). | [epic-lives-and-pressure](./epic-lives-and-pressure.md) |

---

## 9. Mutators (non-3D)

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Sticky fingers discoverability | **Functional** | Easy to miss without dedicated affordance. | [epic-mutators](./epic-mutators.md) |
| Catalog vs renderer | **Functional** | Presentation mutators have sim penalties, renderer tints, and Codex coverage tests; deeper art direction is polish, not missing mechanics. | [epic-mutators](./epic-mutators.md) |

---

## 10. Symbols & generation

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| High-floor pool readability | **Functional** | Large pools are intentional; **wide_recall** does not yet change 3D legibility. | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Puzzle vs catalog renames | **Functional** | Built-in puzzles pin symbol/label pairs—must stay synced with global renames. | [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) |
| Symbol band rotation balance | **Functional** | Confirm per-level curve when balancing ([GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md) §8). | systems analysis |

---

## 11. Route-world pipeline

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Route cards and hard-route anchors | **Functional** | Safe/Greed/Mystery route choices feed next-board generation. Hard non-boss floors add Final Ward, Elite Cache, or Omen Seal; boss route floors add Keystone Pair. | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Route action rules | **Functional** | Match claims route rewards; destroy denies eligible route rewards; peek reveals Mystery Veil/Secret Door/Omen Seal/Mimic Cache without claiming; Stray remove refuses Keystone Pair, Final Ward, and Omen Seal. | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |
| Route-world presentation depth | **Functional** | Rendering/copy surfaces distinguish route families. Remaining polish is final art/audio and deeper trap-family tuning, not missing gameplay plumbing. | [epic-route-world-pipeline](./epic-route-world-pipeline.md) |

---

## 12. Onboarding, Codex, FTUE

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Tutorial pair markers WebGL | **Shippable** | Early floors + powers FTUE gate: **`TutorialPairMarkerPlane`** on hidden backs (`TileBoardScene`) when `showTutorialPairMarkers` is on. | [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) |
| Codex vs every edge case | **Functional** | Reference screen, not exhaustive spec (e.g. sticky HUD-only). | [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) |

---

## 13. Motion & shuffle paths

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| DOM FLIP shuffle | **Functional** | WebGL is the active shuffle presentation path; legacy helper exports are retained as tested utilities, not a separate open runtime path. | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |
| Experimental framing | **Functional** | Spaghetti/breathing—verify vs current CSS and mobile camera. | [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) |

---

## 14. Challenge contracts & relics

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Scholar / pin vow discoverability | **Functional** | New players may not distinguish modes without codex or locked power feedback. | [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) |
| Relic pool depth | **Functional** | Small fixed pool; not dynamic rotation in current design. | [epic-relics](./epic-relics.md) |
| Relic “immediate” hooks | **Functional** | Some `applyRelicImmediate` paths read as no-ops but fold into other helpers—easy to misread as missing ([GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md) §8). | systems analysis |

---

## 15. Read-only meta UI (Codex, Collection, Inventory)

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Inventory overlay vs live run | **Functional** | Rare drift if run mutates while overlay open (Zustand live). | [epic-readonly-meta-ui](./epic-readonly-meta-ui.md) |
| Collection illustrations | **Functional** | Sections illustrative; real symbols from `tile-symbol-catalog`. | [epic-readonly-meta-ui](./epic-readonly-meta-ui.md) |

---

## 16. Choose Your Path (presentation shell)

Technical + UX notes live in [epic-choose-your-path](./epic-choose-your-path.md) (layout/zoom pipeline, pager math, **cross-platform interaction**, QA matrix). Presentation + **drag-first library** (fourth pass, 2026-04) are reflected there; see epic **Tasks**.

| Item | Status | Notes | Epic |
|------|--------|-------|------|
| Library vs hero visual density | **Shippable** | Scroller min/max + library card padding vs Featured; compact / short-landscape overrides. | [epic-choose-your-path](./epic-choose-your-path.md) |
| Mode poster art | **Functional** | Each live catalog `posterKey` resolves to bundled raster art; only the explicit fallback key keeps shared placeholder treatment. | [epic-choose-your-path](./epic-choose-your-path.md) |
| Pager / search / affordances | **Shippable** | **Magnifier** toggles search; **no** Previous/Next buttons; dots + **drag / swipe** tray; edge fades. | [epic-choose-your-path](./epic-choose-your-path.md) |
| Fit-zoom + nested horizontal scroll | **Functional** | `useFitShellZoom` on outer path stack + library `overflow-x`; re-verify on short viewports when layout changes. | [epic-choose-your-path](./epic-choose-your-path.md) |

---

## 17. Ongoing recommendations (from systems analysis)

From [GAMEPLAY_SYSTEMS_ANALYSIS.md](../GAMEPLAY_SYSTEMS_ANALYSIS.md) §10:

1. Keep **MUTATORS.md**, **catalog**, and **game.ts + renderer** aligned as mechanics evolve.
2. **Optional:** Additional e2e for board flows; **balance** follow-ups per [BALANCE_NOTES.md](../BALANCE_NOTES.md) and `tile-symbol-catalog` curves.
3. **`mutators.ts`** — light coverage in **`src/shared/mutators.test.ts`** (catalog/daily table + `hasMutator`); full behavior remains in **`game.test.ts`** and integration/e2e.

**Floor mutator schedule (tests):** `src/shared/floor-mutator-schedule.ts` drives endless per-floor mutator lists and `floorTag` pacing (`pickFloorScheduleEntry`, `usesEndlessFloorSchedule`, `FLOOR_SCHEDULE_RULES_VERSION`). **`src/shared/floor-mutator-schedule.test.ts`** already covers mode gates, cycle wrap, the boss-floor branch that sometimes appends `distraction_channel` without duplicating mutators, and the [BALANCE_NOTES.md](../BALANCE_NOTES.md) seed smoke. When you change schedule rules, bump **`FLOOR_SCHEDULE_RULES_VERSION`** in `floor-mutator-schedule.ts` and extend the suite per the header checklist there (and keep [epic-mutators](./epic-mutators.md) **Schedules** in sync).

**Where tracked as tasks:** (1) and (3) → [epic-mutators](./epic-mutators.md) **Tasks**; (2) e2e → [epic-board-rendering-assists](./epic-board-rendering-assists.md) optional task; balance / symbol bands → [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) **Tasks**.

---

## Quick index by epic rough-edge theme

| Epic | Primary gap theme |
|------|-------------------|
| [epic-board-rendering-assists](./epic-board-rendering-assists.md) | 3D presentation mutators, prop wiring |
| [epic-mutators](./epic-mutators.md) | Visual reading vs score tax, sticky UX |
| [epic-core-memory-loop](./epic-core-memory-loop.md) | `wildTileId`, puzzle board completeness |
| [epic-powers-and-interactions](./epic-powers-and-interactions.md) | `powersUsedThisRun` / perfect clear semantics, flash pair |
| [epic-meta-progression](./epic-meta-progression.md) | Telemetry sink, achievement clarity |
| [epic-audio-feedback](./epic-audio-feedback.md) | Procedural gameplay SFX vs product audio pass |
| [epic-modes-and-runs](./epic-modes-and-runs.md) | Import, replay, naming |
| [epic-onboarding-codex-copy](./epic-onboarding-codex-copy.md) | Tutorial copy vs WebGL badges |
| [epic-presentation-motion-fx](./epic-presentation-motion-fx.md) | Dual shuffle paths, experimental FX |
| [epic-scoring-objectives](./epic-scoring-objectives.md) | Thematic clarity when visuals stubbed |
| [epic-run-session-flow](./epic-run-session-flow.md) | Timer pairing, undo edge cases |
| [epic-contracts-challenge-runs](./epic-contracts-challenge-runs.md) | Discoverability |
| [epic-lives-and-pressure](./epic-lives-and-pressure.md) | Gauntlet depth, parasite explanation |
| [epic-content-symbols-and-generation](./epic-content-symbols-and-generation.md) | Readability curve, puzzle sync |
| [epic-relics](./epic-relics.md) | Pool size / discovery |
| [epic-readonly-meta-ui](./epic-readonly-meta-ui.md) | Illustrative vs live data |
| [epic-choose-your-path](./epic-choose-your-path.md) | CYP: drag-first library, magnifier search, touch + mouse; optional per-mode art later |

---

*This document is a **rollup**. Authoritative per-mechanic truth remains in the catalog and individual epics.*
