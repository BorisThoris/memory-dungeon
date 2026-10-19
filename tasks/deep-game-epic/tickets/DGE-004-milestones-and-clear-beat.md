# DGE-004: Milestone fractions on the run bar and the clear beat

## Status
Not started

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
Leave next steps, checklist rows ticked, and known blockers here after implementation.
