# DGE-001: North star, scope, and the measured plateau

## Status
Done (2026-10-19)

## Priority
P0

## Phase
0 · Spine

## Subsystem
Spine

## Depends on
- None

## Current repo context
- `tasks/deep-game-epic/00-the-plateau-measured.md`, `tasks/deep-game-epic/02-deep-game-plan.md`, `docs/BALANCE_NOTES.md` Gen 207 and 211, `src/shared/floor-mutator-schedule.ts`, `src/shared/pair-curve.ts`.
- Overlapping earlier tickets: `tasks/refined-experience-gaps/REG-018` (endless shipping plan), `REG-019` (relic archetypes), `REG-020` (mutator chapter identity).

## Problem
The pack exists because the late game does not change. Before any ticket below is picked up, the measurements must be re-run on the current `main` so the plan is tuned to the game as it is, not as it was on 2026-10-19.

## Target experience
A future session opens this pack, re-measures the four plateau facts in under an hour, and knows which tickets are still true.

## Implementation notes
- Run `yarn sim:run` at the reference miss rates and record run-end floors.
- Run `yarn sim:pop` and `scripts/sim-pop-share.ts` and record the pop share by pair count.
- Confirm `ENDLESS_CYCLE_FLOOR_COUNT`, `BOSS_ROTATION_CYCLE_POSITION` and `PAIRS_MAX` are unchanged; if any moved, update `00-the-plateau-measured.md` and the dependent tickets.
- Decide the three open decisions in `03-execution-ledger.md` with the owner, or record the default the plan takes.
- Mark REG-018, REG-019 and REG-020 as superseded-in-part by this pack in their files, with a link, rather than deleting them.

## Acceptance criteria
- `00-the-plateau-measured.md` carries today's numbers with the command that produced each.
- The three open decisions have an answer or a stated default.
- The superseded REG tickets link here.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- None beyond the simulators named; this ticket changes no runtime code.

## Risks and edge cases
- Re-measuring on a loaded machine: the timing-sensitive tests in CLAUDE.md are not involved, but `sim:run` at 200 seeds is slow; use the default seed count.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
2026-10-19: re-measured on main at rules 69; today's numbers and commands are in `00-the-plateau-measured.md` ("Re-measured"). Fact 4 changed: the miss bank now ends runs (15% misses, median floor 20), so DGE-005 and DGE-032 should be re-read against it. The three open decisions carry stated defaults in the ledger (Warden at 60, four relic slots, Endless boards grow). REG-018, REG-019 and REG-020 link here. Checklist rows: none apply (no runtime code); the CLAUDE.md pre-commit list ran. Next: DGE-002 and DGE-003.
