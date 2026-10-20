# DGE-012: Pop share by act with Hold: the band and the gate

## Status
Done for the measurement (2026-10-20); the 0.6 bar waits for DGE-008.

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
2026-10-20:
- `scripts/sim-pop-share.ts` takes `--floors=N`, `--by-act` (grouped by `DESCENT_ACTS`) and `--check`. `gate:pop-by-act` (`--floors=60 --by-act --check`, about three seconds) runs in `gate:systems`.
- Before numbers (BALANCE_NOTES, "Pop share by act"): the Gate 0.33, the Living Dungeon 0.35, the Deep 0.40, the Abyss 0.44, and 0.40 overall. Floors 1-24 alone reproduce DGE-001's 0.34. By act this is a rising curve, not a hill: the hill DGE-001 saw is within the Gate (floors 4-12).
- The bar: `POP_BY_ACT_MIN` is 0 until the Hold exists. DGE-008 raises it to 0.6 for Acts II to IV and adds the Hold-using player profile, which this ticket could not add without the verb.
- The player is the perfect-memory one. DGE-032's Goldilocks probe needs a player with limited memory; build it there and reuse it here.
