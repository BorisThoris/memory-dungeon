# DGE-027: Hall rooms, soak invariants and the accountability checklist for every mechanic

## Status
Not started

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
