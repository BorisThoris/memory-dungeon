# DGE-019: Echo: replay your last three flips free

## Status
Not started

## Priority
P1

## Phase
4 · Act IV

## Subsystem
Verb

## Depends on
- `DGE-015`

## Current repo context
- The flip history on `RunState` (`flipHistory`, used by the results timeline), `board-power-actions.ts`, the dock.

## Problem
Act IV's verb should pay for skill directly: the player who just played well gets to play more.

## Target experience
Once per floor, Echo replays the last three flips in order as free turns (no turn cost, misses still cost). It is only worth using after three good flips. The Echo Chamber evolution makes it five.

## Implementation notes
- `echo-rules.ts`: `echoAvailable`, `replayFlips(run, board)` driving the flip transition with the recorded tile ids (skipping cards no longer on the board).
- Dock tool; counters; Codex; graph; census.

## Acceptance criteria
- An Echo of three matching flips produces the same outcomes the originals did when the board is unchanged (determinism test).
- Echo never grants a turn beyond the three flips.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall rooms "Echo three" and "Echo after a move"; e2e tool; soak.

## Risks and edge cases
- Replaying on a board that moved (Wanderers) must resolve by tile id, never by cell.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
