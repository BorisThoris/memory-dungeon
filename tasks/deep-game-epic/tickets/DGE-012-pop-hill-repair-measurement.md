# DGE-012: Pop share by act with Hold: the band and the gate

## Status
Not started

## Priority
P0

## Phase
1 · Act II

## Subsystem
QA

## Depends on
- `DGE-002`

## Current repo context
- `scripts/sim-pop-share.ts`, `scripts/sim-cascade.ts`, `scripts/sim-endless.ts`, `gate:balance-depth`, `gate:difficulty-curve` in `package.json`; `docs/BALANCE_NOTES.md` Gen 211 (measure matched vs popped share, not pairs per match).

## Problem
The pop hill is measured by pair count. The plan needs it measured by act, with and without Hold, and held by a gate.

## Target experience
`yarn sim:pop-share --by-act` reports matched versus popped share per act for the four simulated players; a gate fails if any act after the first falls under 0.6 once DGE-008 lands.

## Implementation notes
- Extend `sim-pop-share.ts` with act grouping from `DESCENT_ACTS` and a Hold-using player profile.
- Add `gate:pop-by-act` to the `gate:systems` composite (or to `STANDALONE_GATES` with the reason).
- Record the before numbers in `docs/BALANCE_NOTES.md` as a new generation entry.

## Acceptance criteria
- The report exists and runs in `gate:systems`.
- Before Hold: the numbers reproduce Gen 211's hill. After Hold: Acts II to IV at or above 0.6.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `sim-endless-output.test.ts` style snapshot for the report shape; gate reachability audit passes.

## Risks and edge cases
- A new gate script must be reachable (`audit:gate-reachability`).

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
