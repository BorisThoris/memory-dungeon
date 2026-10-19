# DGE-004: Milestone fractions on the run bar and the clear beat

## Status
Done (2026-10-20) for the run bar and the clear beat; the camp parts are moot (see notes).

## Priority
P0

## Phase
0 · Spine

## Subsystem
HUD

## Depends on
- `DGE-002`

## Current repo context
- `src/renderer/components/RunShell.tsx` (run bar), `FloorClearBeat.tsx`, the camp screen reached through `run-store-rules.ts` (`STORE_STOP_EVERY_FLOORS = 3`) with its Descend button, `floor-clear-transition.ts`.
- Goal-gradient and post-reward reset findings (`../01-research-findings.md`): effort tracks the fraction remaining; quitting peaks right after a reward.

## Problem
The clear beat and the camp show the reward and nothing beyond it. That is the moment the field data says players quit.

## Target experience
From floor one the run bar shows "Next: The Keeper of Halls, 7 of 12" as a fraction. The clear beat and the camp show the next milestone with floors to go. When a new track opens (Depths, a realm's raging track), it opens with progress already banked. Descend is the focused default on the camp.

## Implementation notes
- `src/shared/milestone-rules.ts`: `nextMilestone(run)` from `DESCENT_ACTS` (act bosses at 12, 24, 40, 60; in Endless, the next cycle boss), returning name, floorsDone, floorsTotal.
- Run bar element `MilestoneMeter` (fraction, name); FloorClearBeat line "Three floors to the Cartographer"; camp header carries the same line and the Descend button text names the milestone.
- Pre-filled progress: a track definition declares `endowedProgress` (for example the Depths ladder opens at 2 of 10 from the unlocking run); shown as already-filled segments with the Codex explaining why.
- Focus order: Descend is the first focusable control on the camp for keyboard and controller (`useGamepadNavigation`).

## Acceptance criteria
- Every clear and camp screen shows the next milestone name and fraction (playtest screenshots checked by eye).
- The fraction is proportional, never absolute: a test asserts the meter reads 0.5 at floor 6 of 12 and at floor 32 of 40 measured from 24.
- No milestone is ever shown that the player cannot finish (thesis §25.11): every track has a defined end.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `milestone-rules.test.ts`; `FloorClearBeat.test.tsx`; `RunShell.test.tsx`; `e2e/controller-navigation.spec.ts` for the camp focus order; `yarn test:e2e:playtest` screenshots.

## Risks and edge cases
- The run bar is dense on 390x844; the fit contract decides whether the meter collapses to the fraction alone on phones.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
2026-10-20:
- `src/shared/milestone-rules.ts`: `nextMilestone(level)` gives the milestone a floor walks toward: the end of its Descent act. Those are The Living Dungeon (12), The Keeper of Halls (24), The Cartographer (40) and The Warden (60), the names from `02-deep-game-plan.md`. It returns floorsDone, floorsTotal and a proportional fraction measured from the act's start (6 of 12 is 0.5, and floor 32 is 8 of 16). `milestoneAfterClear(level)` gives the same for the floor after a clear, plus floorsToGo. Past 60 the Abyss repeats, so the Warden stands every twenty floors and no track is endless (tested to floor 1000).
- Run bar: `hud-milestone` ("Next: The Keeper of Halls  7 of 12", a gold hairline filling under it) sits in its own cell, outside `hud-floor`, so the floor reading's digits stay alone. Phone layouts show the fraction only. Clear beat: `floor-clear-milestone` ("Three floors to the Keeper of Halls") under the payout. Pass-and-play shows neither, because its floors count to an agreed end.
- Moot: the camp header and the Descend focus order. The store stop became automatic camp upgrades (no screen, the next floor starts by itself; hall room `store-stop`), so the clear beat is the one reward moment and carries the line. Endowed progress has no track to open yet (Depths is DGE-006); add `endowedProgress` with the first track that opens mid-run.
- The boss names are placeholders for the act boss floors, which still raise the Keystone Warden identity until DGE-011, DGE-018 and DGE-005 land. Those tickets should keep `DESCENT_MILESTONE_NAMES` in step.
- Checklist rows: no rules change, no graph node (a reading of the schedule, not a mechanic), unit tests for the rules, the beat and the bar; ui-fit, HUD layout and playtest screenshots checked.
