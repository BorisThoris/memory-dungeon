# Gameplay tasks: findables

**System spec:** [`docs/FINDABLES.md`](../FINDABLES.md)  
**Backlog:** **FN-01** in [`gameplay-depth/05-app-specific-idea-backlog.md`](../gameplay-depth/05-app-specific-idea-backlog.md)

---

## GP-FIN01 — Types, constants, mutator gate

### Status
**Done** — `FindableKind`, `findables_floor` ([`contracts.ts`](../../src/shared/contracts.ts), [`mutators.ts`](../../src/shared/mutators.ts)).

### Priority
Medium

### Objective
Introduce `FindableKind` (or equivalent), optional `findableKind` on `Tile`, and a **mutator** that gates findable spawning (v1: **findables off** unless mutator active). No gameplay behavior beyond “mutator exists in catalog.”

### Spec reference
[`FINDABLES.md`](../FINDABLES.md) — Data model, v1 gate.

### Affected areas
- `src/shared/contracts.ts` — `MutatorId`, `Tile`, optional `RunState` fields stub.
- `src/shared/mutators.ts` — `MUTATOR_CATALOG` entry + `DAILY_MUTATOR_TABLE` policy (optional; may exclude until balanced).
- `docs/MUTATORS.md` — one row for new mutator.

### Acceptance criteria
- Typecheck clean; no findables spawn yet (FIN02).
- Mutator documented with upside/downside (e.g. “Bonus pickups on the board; more to track during memorize.”).

### Dependencies
None.

### Out of scope
Renderer, scoring.

---

## GP-FIN02 — Seeded placement at `buildBoard`

### Status
**Done** — [`buildBoard`](../../src/shared/game.ts) tagging; tests `describe('findables_floor')` in [`game.test.ts`](../../src/shared/game.test.ts).

### Priority
Medium

### Objective
When findable mutator is active, assign `findableKind` to **0–2** pairs after tile creation; **never** on decoy; deterministic from run seed + level + rules version.

### Spec reference
[`FINDABLES.md`](../FINDABLES.md) — Generation, interactions.

### Affected areas
- `src/shared/game.ts` — `buildBoard` / `createTiles` path.
- `src/shared/rng.ts` or string seed helper (pattern match existing `deriveLevelTileRngSeed`).
- Unit tests: same seed + level → same findable pairs; decoy never tagged.

### Acceptance criteria
- Count cap enforced; replay determinism test.
- Wild / endless / daily respect `activeMutators` as today.

### Dependencies
**GP-FIN01**

### Out of scope
Claim / rewards.

---

## GP-FIN03 — Claim rules in match / destroy / shuffle

### Status
**Done** — match/destroy/shuffle tests in [`game.test.ts`](../../src/shared/game.test.ts) (`findables_floor` describe).

### Priority
Medium

### Objective
On **successful match**, if pair carried findable → **claim** (clear `findableKind` on those tiles, increment counters). **Destroy pair:** per spec — v1 **forfeit** findable (no claim). **Shuffle:** findables stay on **tile identity** after permutation.

### Spec reference
[`FINDABLES.md`](../FINDABLES.md) — Interactions.

### Affected areas
- `src/shared/game.ts` — `resolveTwoFlippedTiles` (or equivalent match path), `applyDestroyPair`, `applyShuffle` / `applyRegionShuffle` (verify tile objects move, not stale ids).
- `RunState` — `findablesClaimedThisFloor` updates; reset in `advanceToNextLevel`.

### Acceptance criteria
- Tests: match claims; destroy does not grant reward; shuffle preserves findable on moved tiles.

### Dependencies
**GP-FIN02**

### Out of scope
Score numbers (FIN04).

---

## GP-FIN04 — Rewards and scoring bookkeeping

### Status
**Done** — `FINDABLE_MATCH_SCORE`, `FINDABLE_MATCH_COMBO_SHARDS`, `FINDABLE_MATCH_SAFE_HAZARD_WARDS`, and `FINDABLE_MATCH_SCOUT_REVEALS` ([`contracts.ts`](../../src/shared/contracts.ts)); claim path [`game.ts`](../../src/shared/game.ts).

### Priority
Medium

### Objective
Apply **agreed v1 reward** (flat score and/or shard step) at claim time or fold into `finalizeLevel`; ensure `totalScore` / `LevelResult` stay consistent with [`GAME_RULES_VERSION`](../../src/shared/contracts.ts).

### Spec reference
[`FINDABLES.md`](../FINDABLES.md) — Rewards, LevelResult.

### Affected areas
- `src/shared/game.ts` — constants for findable bonus; match resolution.
- `src/shared/contracts.ts` — optional `bonusTags` e.g. `findable_claimed` if end-of-floor summary desired.
- Bump `GAME_RULES_VERSION` if scoring semantics change.

### Acceptance criteria
- Tests: claim increases score or shard state as specified; meditation / gauntlet modes handled per existing patterns.

### Dependencies
**GP-FIN03**

### Out of scope
UI copy beyond a single toast line (FIN05).

---

## GP-FIN05 — Renderer, HUD, codex

### Status
**Done** — WebGL + DOM markers [`TileBoardScene.tsx`](../../src/renderer/components/TileBoardScene.tsx), [`TileBoard.tsx`](../../src/renderer/components/TileBoard.tsx); mechanics encyclopedia topics.

### Priority
Medium

### Objective
**Visible** findable marker on carrier tiles (memorize + face-up paths: DOM + WebGL if applicable); optional HUD “Bonuses on board: N”; codex / mutator text references findables.

### Spec reference
[`FINDABLES.md`](../FINDABLES.md) — Presentation & accessibility.

### Affected areas
- `src/renderer/components/TileBoard.tsx`, `TileBoardScene.tsx`, `TileBoard.module.css` (or shared marker component).
- `GameScreen.tsx` — minimal HUD line if spec calls for it.
- Codex screen if mutator list is centralized there.

### Acceptance criteria
- Not color-only; respects `reduceMotion` for any animation.
- e2e or visual smoke optional (document in task when done).

### Dependencies
**GP-FIN02** (data on tiles); **GP-FIN04** optional for toast on claim.

### Out of scope
Marketing art pass.

---

## GP-FIN06 — Export/import, docs sweep, regression tests

### Status
**Done** — [`FINDABLES.md`](../FINDABLES.md) export section; regression coverage via shared tests above.

### Priority
Low

### Objective
Confirm `createRunFromExportPayload` + endless schedule reproduce findable **presence** when mutator gate matches; update [`run-export`](../../src/shared/run-export.ts) docs in `FINDABLES.md` or `MUTATORS.md` if needed. Add/extend `game.test.ts` coverage for FIN02–FIN04.

### Spec reference
[`FINDABLES.md`](../FINDABLES.md) — Export section.

### Affected areas
- `src/shared/run-export.ts`, `game.ts` import path.
- `src/shared/game.test.ts`

### Acceptance criteria
- Documented whether export needs new fields; tests green.

### Dependencies
**GP-FIN04**

### Out of scope
Steam achievements.

---

## Suggested order

1. **GP-FIN01** → **GP-FIN02** → **GP-FIN03** → **GP-FIN04** (vertical slice in shared code).  
2. **GP-FIN05** in parallel once tiles carry `findableKind`.  
3. **GP-FIN06** before shipping to players with export.
