# DGE-027: Hall rooms, soak invariants and the accountability checklist for every mechanic

## Status
In progress (standing ticket): the planned soak player and the coverage audit done 2026-10-21; it stays open while the pack adds mechanics.

## Priority
P0

## Phase
Cross-cutting

## Subsystem
QA

## Depends on
- `DGE-001`

## Current repo context
- `src/shared/test-hall-rooms.ts` (`TEST_HALL_RESEEDS`, `TEST_HALL_CHECKED_ELSEWHERE`), `run-soak.ts`, `scripts/mechanic-accountability.ts` (`MECHANIC_CENSUS_EXEMPTIONS`), `system-refinement-ledger.ts`, `gameplay-interaction-graph-data.json`, the `/__hall` coverage panel.

## Problem
The pack adds thirteen mechanics. If their coverage is left to a later sweep it will not happen.

## Target experience
A standing ticket that each mechanic ticket points at, plus the shared work: a hall room template for the new seams, a soak player profile that uses the new verbs, and the census counters registered.

## Implementation notes
- Add a fifth soak player, "planned", who uses Hold, Carve and Echo and takes raging doors.
- A hall room authoring helper for two-layer and Fold boards.
- Keep the `/__hall` coverage panel's "mechanics without a room" list at zero at the end of every phase.

## Acceptance criteria
- Every mechanic in the graph from this pack has a room, two walks, a ledger entry, a census counter, and its writes read somewhere.
- `yarn gate:systems` is green at the end of every phase.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `test-hall-rooms.test.ts`, `run-soak.test.ts`, `mechanic-accountability.test.ts`.

## Risks and edge cases
- The hall e2e loads every room in a browser; thirty more rooms lengthen it; keep rooms small.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.

2026-10-21:
- **The planned player** (`SOAK_PLAYERS.planned`, `run-soak.ts`): misses one turn in ten, plays the elements, and holds for a stack of five before releasing (`holdRelease`); `run-soak.test.ts` requires a release of five. Taking raging doors was dropped: current runs travel to a seeded realm, there is no door to choose (doors retired with DGE-003). Carve and Echo join it when DGE-015 and DGE-019 land.
- **It found a softlock at once**: on a Layers floor the Hold can keep both halves of a lower pair under held cells, and the unlock lifted one card only. `promoteBeneath` now lifts until a pair is face down. No rules bump: the old behaviour was a stuck board, so no finished run's replay depends on it. Soak, five players x 200 seeds: 0 violations (planned: 4,937 floors).
- **Coverage**: every one of the graph's 77 mechanics is walked at least twice (`testHallChecksByMechanic`), the `/__hall` list of mechanics without a room is empty.
- **Census**: of the pack's mechanics only the Wanderers have a counter (run census, 0.383). Dread, the Warden, Endless rent, the Hold, the Fold and Layers carry argued exemptions in `mechanic-accountability.ts`, each naming why the census cannot see it (floors past 24, a verb the census players never press, a shape rather than an event) and what checks it instead. A census that plays floors 25-60 would retire most of them; that is DGE-032's ground.
- **Room helpers**: `layeredRoom` (two decks) is in `test-hall-rooms.ts`; a Fold room needs only `board: { fold }` on `room()`.

2026-10-22, the end of the pack's mechanic phase:
- **Carve and Reprise joined the planned player** as the 2026-10-21 note promised: `carveRate: 0.15` aims the next pop at random, and every player presses Reprise once its last turns were all matches. Deep soak with every Depth (`--floors=62 --depths`, 210 seeds x 5 players): planned 1,043 carves (718 spent) and 81 Reprises, careful 373 Reprises, 0 violations at every Depth.
- **Coverage**: the graph has 88 mechanics; every one is walked twice or named in `TEST_HALL_CHECKED_ELSEWHERE` (`progression.depths` joined it: a Depth is chosen before any board, so the soak's `--depths` and a unit test per rung check it). Each pack mechanic has a ledger entry and a census counter or an argued exemption; `gate:systems` green on every ship of the phase.
- Still open (why this ticket stands): the census plays floors 1-24, so the Act III/IV mechanics keep exemptions that a deep census would retire (DGE-032's ground).
