# DGE-006: Endless as an unlocked mode with its own scaling

## Status
In progress (2026-10-20): the choice, the cycles and the milestones are done; the rent is next.

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
2026-10-20, part 1:
- The owner's call, asked 2026-10-20: the player **chooses at the Warden's clear**. "Take the win" ends the run as THE WARDEN FALLS, as DGE-005 shipped it. "Descend into Endless" sets `run.endless`, and the same run goes on from floor 61; it is recorded once, when it ends.
  - `awaitsWardenChoice` / `descendIntoEndless` live in `warden-rules.ts`, with `endRunAfterWardenClear` skipping an Endless run.
  - The choice is an `OverlayModal` (`warden-choice`). A board overlay was first tried, and the Colossus stone and the board canvas caught its clicks (playtest). The floor-clear beat waits for the answer instead of continuing, and drops its milestone line while it waits.
  - Only a run that just cleared the Warden can enter: `endless` is set nowhere else.
- Endless cycles (`endlessPlaceForLevel`, `endlessActLength` in `floor-mutator-schedule.ts`) replace "the Abyss repeats". Past 60 the four acts come round with each act half as long per cycle, never under four floors:
  - cycle 1: 6/6/8/10 (61-90)
  - cycle 2: 4/4/4/5
  - cycle 3 on: 4 each
  A floor plays as the Descent floor at the same share of its act, so each act starts on its first room and ends on its boss. The Warden falls on 90, 107, then every sixteen floors. `FLOOR_SCHEDULE_RULES_VERSION` 7, schedule-only.
- The milestones (`nextMilestone`) follow the cycle's acts. The test pace runs on past 60 through each Endless act's start and boss for two cycles (`FAST_ENDLESS_RUNGS`).
- The board already grows past 60 (`pairsForFloor`, 24 pairs doubling every 30 floors). Gating that growth on `run.endless` is moot: a run that takes the win never builds floor 61. The fit at 390x844 with 25-48 pairs is what the Endless playtest's screenshots are for: `test-results/playtest/test-pace-endless/` walks the menu to floor 90, 48 pairs at the last, at 1280x720. The phone at those sizes is unmeasured.
- Codex: the Warden topic now ends on the choice and Endless (encyclopedia 96).
- Next (part 2): the rent. A score each Endless floor must reach, rising 1.25x per cycle, shown as the milestone fraction; falling short ends the run with `rent_unpaid`. Measure the median floor score at depth before choosing the base, as with DGE-003's tiers. Also: a soak invariant (rent paid or the run ended), and a hall room at floor 61.
