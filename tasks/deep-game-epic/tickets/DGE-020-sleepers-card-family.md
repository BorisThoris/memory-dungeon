# DGE-020: Sleepers: matched pairs that return unless chained

## Status
Done (rules 84, 2026-10-22)

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

2026-10-22, built (rules 84):
- `sleeper-rules.ts`: `dealSleepers` (two pairs a floor from 41, three from 51, on plain pairs, after the masks), `applySleeperTurn` (after the Hold, before the Keeper): a Sleeper matched on a chain under three sleeps and wakes four turns later, face down, in two other cleared cells (`wakeSleeper`, `pickRngIndex`); a chain of three keeps it down. `Tile.sleeper`, `RunState.sleepingPairs`, counters woken and kept down.
- The inspector's "finishable" acceptance: a board cleared with a Sleeper asleep wakes it (`finalizeLevel` -> `wakeAllSleepers`), so the floor always has cards left to play. A Sleeper matched on the very turn that clears the board does not sleep: the clear ends the floor.
- **No mark on the back** (the ticket asked for one): the owner's rule for face-down cards outranks it, so a Sleeper is named on its face (screen reader) and the key says "Sleepers" while any stands or sleeps, never which. Pricing: a floor count, as the Masks (no Dread table exists).
- The deep soak found a Sleeper matched while holding woke as a held seed; waking now takes it out of the Hold (unit test).
- Hall rooms `sleeper-wakes` ("Sleeper wakes"), `sleeper-chain` ("Chain keeps it down"); unit tests; soak invariants (woken face down; no floor cleared with one asleep). Deep soak to 62: 198 woken, 764 kept down, 0 violations. warden-reach 55/100. The wildfire hall room re-pinned to seed 90213 after the reseed.
- Not done: a wake animation from the room's material (DGE-030).
