# DGE-020: Sleepers: matched pairs that return unless chained

## Status
Not started

## Priority
P1

## Phase
4 · Act IV

## Subsystem
Card family

## Depends on
- `DGE-016`

## Current repo context
- `floor-clear-transition.ts`, the match seam, `chain-tier-rules.ts` for chain length, `MUTATORS.md` seam order.

## Problem
Act IV should make clearing fast the only way to clear at all.

## Target experience
Some pairs are Sleepers: four turns after they are matched they return face-down in new cells, unless the match was part of a chain of three or more. Priced 9.

## Implementation notes
- `sleeper-rules.ts`: `sleepingPairs` with a wake turn; on wake, placed into free cells by `pickRngIndex`; the floor's clear condition counts sleeping pairs as unmatched.
- Mark on the back; a wake animation from the floor (the room's material); Codex; counters; census.

## Acceptance criteria
- A chained Sleeper never returns; an unchained one always does within four turns while cells are free.
- Inspector: a floor with only sleeping pairs left is still finishable.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall rooms "Sleeper wakes" and "Chain keeps it down"; soak; sim.

## Risks and edge cases
- Generation and scoring: `GAME_RULES_VERSION`.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
