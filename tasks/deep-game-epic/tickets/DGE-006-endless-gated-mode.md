# DGE-006: Endless as an unlocked mode with its own scaling

## Status
Not started

## Priority
P1

## Phase
0 · Spine

## Subsystem
Spine

## Depends on
- `DGE-005`
- `DGE-031`

## Current repo context
- `src/shared/pair-curve.ts` (`PAIRS_MAX = 24`, `LATE_PAIRS_MAX = 4096`), `scripts/sim-endless.ts --deep-floors`, `long-run-depth.ts`, `profile-deepest-floor.ts`, `tasks/refined-experience-gaps/REG-018`.
- Only `classic` and `pass_and_play` ship (CLAUDE.md); Endless is a continuation of a classic run past the Warden, not a new menu mode, so that rule holds.

## Problem
Today "endless" is the same twelve floors forever and the board freezes at 52. The everscaling promise has nowhere to live.

## Target experience
Beating the Warden offers Continue into Endless. Endless repeats the four acts with each act's length halved per cycle (minimum four floors), every verb and family in play, Dread compounding, the board allowed to grow past 24 pairs along the deep-floor curve the simulator supports, and a per-floor rent (a score the floor must reach) that rises per cycle so a run has a reason to end.

## Implementation notes
- `DESCENT_ACTS` cycle rule for levels past 60 in `floor-mutator-schedule.ts`; `endlessCycleIndex(level)`.
- `pair-curve.ts`: a second curve past the Warden toward `LATE_PAIRS_MAX`, gated by a run flag `run.endless`, so classic floors keep `PAIRS_MAX`.
- `src/shared/endless-rent-rules.ts`: rent per floor = act base x 1.25 per cycle; falling short ends the run with `outcome: 'rent_unpaid'`.
- Save: `unlocks` gains `endless` (DGE-031); the main menu shows Endless reached and deepest cycle on the Profile screen.
- Daily stays on its own schedule; Endless is never the daily.

## Acceptance criteria
- A run cannot enter Endless without `outcome: warden_cleared` in this run.
- `yarn sim:endless --deep-floors` plays cycles 1 to 3 and every board size the curve reaches; the board inspector holds at every size.
- Rent is shown on the run bar as the milestone fraction (DGE-004) so the next goal is still visible.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `endless-rent-rules.test.ts`; schedule tests for cycle compression; `run-soak.ts` Endless invariant (rent paid or outcome set); e2e: a hall room boots at floor 61 via `?hallRoom=`.

## Risks and edge cases
- Board sizes past 24 pairs change the renderer's camera fit and tile type size (`min-type-size.ts`, `audit:min-type-size`); the fit contract must pass at 390x844 with 32 pairs before growth is enabled.
- Rent could read as a timer that punishes; it is a score bar, never a clock, and it is stated on the floor before play.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
