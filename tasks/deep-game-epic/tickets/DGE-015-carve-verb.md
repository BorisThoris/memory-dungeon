# DGE-015: Carve: aim which way the cascade walks

## Status
Done (rules 79, 2026-10-21)

## Priority
P1

## Phase
3 · Act III

## Subsystem
Verb

## Depends on
- `DGE-008`

## Current repo context
- `pop-reach-simulation.ts` (wave order), `board-power-targeting.ts` (a tool that takes a target), the dock catalog, `chain-rung-value-rules.ts` for spending links.

## Problem
The cascade is something that happens to the player. Act III makes it a shot.

## Target experience
Before a flip, Carve spends two chain links to set a direction. The next pop walks that direction first and reaches one cell further along it. The direction is drawn on the board until used.

## Implementation notes
- `carve-rules.ts`: `carveDirection` on `RunState`, consumed by the next pop; reach bias in `pop-reach-simulation.ts` as a seeded tiebreak plus one extra step along the carved axis.
- Dock tool with a direction picker (d-pad, arrow keys, swipe); `tools-usable.spec.ts` case.
- Counter `carvesThisFloor`; Codex; graph; census.

## Acceptance criteria
- A carved pop reaches exactly the cells the simulation predicts for the biased walk (unit test).
- Carve costs links and never a miss or a turn.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall rooms "Carve right" and "Carve has no target"; e2e tool; soak.

## Risks and edge cases
- Scoring change: `GAME_RULES_VERSION`.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.

2026-10-21, built (rules 79):
- `carve-rules.ts`: `canCarve`, `carve`, `spendCarveOnPop`, `spendCarve`; `RunState.carveDirection`, `carvesThisFloor`, `carvesSpentThisFloor`, reset per floor. From floor 25 (the Deep), between turns, for two links of the Hold's meter: the only chain-links meter, so three carves are one Hold not armed. That trade-off is the reading of "spends two chain links".
- **Both pop paths.** Every current run has a realm, so most pops are the reaction burst (`resolveReactionBurst`): carved, it takes the pairs on the carved side first and one more pair of each element. The contact pop (no realm) takes the carved side first under its cap, and its walk reaches one more step along the axis (`findSuitRegion` option `carve`). Unit tests pin both against the expected cells.
- **Consumption.** A pop that takes pairs spends it; a match that pops nothing (a held match, one that does not react) leaves it standing, so a carve set while holding shapes the release (`releaseHold` spends it). A carve with nothing on its side is spent by the plain pop.
- Dock: Carve (conditional, from 25), a four-way picker (OverlayModal; the arrow keys pick), the arrow drawn in the board crown until spent ("Carved right"). Looked at in the isolated browser at 1280 and 390 wide.
- Hall rooms `carve-right`, `carve-no-target`, `carve-through-hold`; `tools-usable.spec.ts` case (press, ArrowRight, match, b pops not a); soak: the planned player carves at 0.15, an invariant (between turns, two links, no turn, never past its floor), counters required by `run-soak.test.ts`. Soak 5 x 200: 1181 carves, 821 spent, 0 violations. warden-reach 59/100.
- Graph `power.carve` (modifies the pop, displays on the HUD), ledger, census exemption, mechanic count 80, Codex `sys_carve`, ENCYCLOPEDIA 106.
- Not done: a swipe gesture for the picker (the d-pad reaches its buttons by focus).
