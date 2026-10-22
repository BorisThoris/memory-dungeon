# DGE-019: Echo: replay your last three flips free

## Status
Done as Reprise (rules 83, 2026-10-22)

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

2026-10-22, built as **Reprise** (rules 83):
- **Named Reprise, not Echo** (the owner): the Echo tile trait and the Echo feedback setting already use the word. The evolution keeps its shipped name, Echo Chamber.
- **What replays** (the owner chose among outcomes, cells and cards): the outcomes. `reprise-rules.ts`: `recordRepriseTurn` keeps what each of the floor's last five turns paid (outermost turn hook); `reprise(run, applyMissBudget)` pays the last three again in order - a match its score and a chain link, a miss its miss (through the bank, which may end the run) and the chain. No card moves, no turn counts; once a floor, from floor 41; `repriseTurnsFor` is five with the Echo Chamber, which is now live.
- The acceptance's "same outcomes as the originals" is met by construction: the replay is the recorded outcome, not a re-run of cards.
- Dock tool (conditional, from 41; badge the matches it would pay), hall rooms `reprise-pays`, `reprise-miss`; `tools-usable` case; soak: every player presses it after three matches, invariant (no turn, once a floor); deep soak to 62: 1055 Reprises, 0 violations (the default soak stops at 30, before it).
- The rules-83 reseed put the run census's peek at 0.900 over 160 runs, a hair over the common line; the census now plays 200 runs (0.895), the remedy rules 68 used.
- Codex `sys_reprise` and the evolutions entry; ENCYCLOPEDIA 110. warden-reach 51/100.
