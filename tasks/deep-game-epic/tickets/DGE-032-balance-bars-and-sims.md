# DGE-032: Balance bars: run-ending, Goldilocks, curve to floor 60

## Status
Not started

## Priority
P0

## Phase
Cross-cutting

## Subsystem
QA

## Depends on
- `DGE-002`
- `DGE-012`

## Current repo context
- `scripts/sim-run-occupancy.ts` (`yarn sim:run`), `sim-difficulty-curve.ts` (`yarn sim:curve`, `gate:difficulty-curve`), `sim-survival.ts`, `sim-archetype-pressure.ts`, `board-inspection.ts`, `docs/BALANCE_NOTES.md`.
- The open research question: which transformation keeps uncertainty intermediate at large boards.

## Problem
The plan makes promises in numbers. The simulators must hold them.

## Target experience
Four bars, each a gate: (1) at 15% misses at least half of average runs end at the Warden and a clean run can clear it; (2) pop share by act at or above 0.6 (DGE-012); (3) a Goldilocks probe: on every floor past 24 the share of cards whose position the simulated player is confident of lies between 0.3 and 0.8 at the study window, so no floor is rote or chaos; (4) `sim:curve` to floor 60 (and 120 in Endless) with a clean player under par on every floor.

## Implementation notes
- Extend `sim:run` with run outcomes by player; extend `sim:curve` range; add the confidence probe to the soak inspector using the player model's memory.
- Each bar becomes a gate in `gate:systems` or a declared standalone.
- Record each generation's numbers in BALANCE_NOTES in the existing style (what was measured, what changed, why).

## Acceptance criteria
- All four gates exist and are green at the end of Phase 1; bar 3 decides which of Layers, Wanderers and the Spiral may be active together on one floor.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Gate reachability audit; the sims' own output snapshot tests.

## Risks and edge cases
- `gameplay-journal-cost.test.ts` and the timing tests misjudge on a loaded machine; run them alone before believing a red.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
