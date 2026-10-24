# DGE-023: The Warden complete: Hold condition and the evolved relic

## Status
Done (rules 78, 2026-10-21)

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

2026-10-21, built (rules 78):
- The owner's calm-path decision: behind the calm door clearing the board still wins (today's Warden). Behind the wild or raging door it is the test: `wardenTestHolds`, `wardenFellsTo`, `wardenDealsAgain` in `warden-rules.ts`; `finalizeLevel` deals again instead of ending a test floor not yet felled; `releaseHold` fells it at 12 held pairs, pairs left or not (and wipes Wanderer footprints, which the soak caught on a felled floor). `RunState.wardenFelled`, `wardenDealsAgainThisFloor`, reset per floor.
- The re-deal waits while a Hold is held. The evolved relic is not required by the rule: a run without one can still hold twelve; Keystone Heart (DGE-014) refills a miss on such a release.
- HUD: the Warden's board line states the 12 and counts the deals (looked at in the isolated browser). Results screen: "Felled by a Hold released at 12 pairs or more", and for a Descent ending on floors 58-60 the distance and the condition (`wardenEndLine`). Codex `sys_warden`, ENCYCLOPEDIA 105.
- Hall rooms `warden-deals-again`, `warden-hold-waits` (the ticket's "Hold suspends the re-deal"), `warden-felled` ("Twelve fells the Warden"). Soak: an invariant that the test Warden never completes without the release of twelve and never leaves an empty board in play; counters `wardenTests`, `wardensFelled`, `wardenDealsAgain`.
- Numbers in BALANCE_NOTES: careful 26/30 felled, planned 4/6; the average player never reaches it in the soak (shortfall recorded). warden-reach 61/100 at 15%.
- Not done: a playtest run to 60 behind the raging door (the test-pace playtest walks the calm win); the "shorter Endless" for a calm-path win was not built (the owner chose that calm clears still win).

2026-10-24: the playtest behind the raging door. `e2e/playtest.spec.ts` "takes the raging door and fells the complete Warden with a Hold": the test-pace tester takes the raging door (the wild one when none rages) before floor 60, starts the Hold once it arms and releases at twelve, through the store's own actions, and the results screen reads "Felled by a Hold". Passes in the isolated station (12.7 min); screenshots of the hold, the release, the choice and the results in `test-results/playtest/test-pace-raging/`. Dying within three floors already shows the distance and the condition (`wardenEndLine`).
