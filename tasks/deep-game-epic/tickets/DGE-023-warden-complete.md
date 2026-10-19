# DGE-023: The Warden complete: Hold condition and the evolved relic

## Status
Not started

## Priority
P0

## Phase
4 · Act IV

## Subsystem
Boss

## Depends on
- `DGE-005`
- `DGE-008`
- `DGE-014`

## Current repo context
- `warden-rules.ts` from DGE-005, `hold-rules.ts`, `relic-evolution-rules.ts`.

## Problem
The first Warden is a wall of attrition. The complete one is a test of a planned build.

## Target experience
The re-deal every five turns is suspended while a Hold is active. The Warden falls only to a Held release of at least twelve pairs. A run with an evolved relic can reach twelve; one without can only out-score it on the calm path, which unlocks a shorter Endless (ledger decision).

## Implementation notes
- Condition wiring; HUD states the number; results screen names how it fell.
- Calm-path variant per the ledger decision.

## Acceptance criteria
- `yarn sim:run`: the planned-build player clears it most of the time, the average player sometimes, the sloppy player rarely; numbers recorded in BALANCE_NOTES.
- Dying at floor 58 or 59 shows the distance and the condition on the results screen.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall rooms "Hold suspends the re-deal" and "Twelve fells the Warden"; soak; playtest run to 60 with `resolveDelayMultiplier` stretched.

## Risks and edge cases
- If twelve is unreachable on 24-pair boards without Layers, the number comes from the sim, not from this ticket.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
