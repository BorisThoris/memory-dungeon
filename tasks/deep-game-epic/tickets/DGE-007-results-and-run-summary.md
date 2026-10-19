# DGE-007: Results screen and run export carry act, tier and distance

## Status
Not started

## Priority
P1

## Phase
0 · Spine

## Subsystem
HUD

## Depends on
- `DGE-003`
- `DGE-004`

## Current repo context
- `GameOverScreen.tsx`, `run-export.ts` (seed, version, floor, score, flip hash), the flip timeline, `profile-deepest-floor.ts`.
- Wordle finding: a near-miss motivates when it carries new information.

## Problem
A death at floor 38 reads as a number. It should read as "two floors from the Cartographer, at Watching, in the Deep".

## Target experience
The results screen names the act reached, the Dread tier, the next milestone and how far it was, and what was new this run (first Wanderer seen, first Hold released). The export string carries act and tier so a shared seed tells the receiver what they are in for.

## Implementation notes
- `run-summary-rules.ts`: `summarizeRun(run)` returning act, tier, next milestone distance, firsts (from the run counters).
- GameOverScreen rows for each; the share string gains `act` and `dread` fields with a schema version.
- Profile screen: deepest act and tier beside deepest floor.

## Acceptance criteria
- Every death and win shows act, tier and distance; a run with a first shows it.
- Import of an old export string without the new fields still works (`run-export` schema test).
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `run-summary-rules.test.ts`; `GameOverScreen.test.tsx`; export round-trip test; playtest screenshots of the results screen at 390x844 (REG-007 above-the-fold rule).

## Risks and edge cases
- The results screen already had three bugs found by the first playtest; look at the screenshots.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
