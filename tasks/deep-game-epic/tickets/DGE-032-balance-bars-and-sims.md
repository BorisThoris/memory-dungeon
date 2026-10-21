# DGE-032: Balance bars: run-ending, Goldilocks, curve to floor 60

## Status
In progress: bars 1, 2 and 4 are gates (2026-10-21); bar 3, the Goldilocks probe, is next.

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

2026-10-21, bars 1, 2 and 4:
- **Bar 1** (the owner chose to meet it as stated, 2026-10-21): rules 73 grow the miss bank with the floor - a clear pays one more per seven pairs, the cap holds one more per six, read off the pair curve (`miss-bank.ts`). 100 seeds: 61 of 100 runs at 15% reach the Warden, 97 at 10% clear it, 20% ends near floor 23, 25% near 12. `gate:warden-reach` (`sim-survival.ts --check`, 100 seeds, in `gate:systems`), mutation-tested: with the scaling off it reads 1% and fails. `SURVIVAL_GATE_SEEDS` adds eighty seeds to the twenty. BALANCE_NOTES has the sweep.
- **Bar 2** stays the existing `gate:pop-by-act` with `POP_BY_ACT_MIN` 0: the 0.6 share is the owner-accepted shortfall (DGE-008).
- **Bar 4**: `CURVE_FLOORS` 60; `gate:difficulty-curve` is green to the Warden's floor (floor 60: 20.4 turns, par 24). Endless to 120 not yet gated.
- Rules 73 reseed: version gate, fifteen ledger quotes; hall rooms and the camp test that hard-coded a cap of four or a grant of one now ask `missBankCap` / `missBankFloorGrant`; the Purse-on-offer room moved to floor 1, where the bank still holds four. Soak 5 x 200: 0 violations.
- **Bar 3, next**: a Goldilocks probe needs a player who forgets - which cards' positions the simulated player is confident of at the study window. The sims are omniscient with a miss rate. That model, and its use to decide which of Layers, Wanderers and the Spiral may share a floor, is the remaining work.
