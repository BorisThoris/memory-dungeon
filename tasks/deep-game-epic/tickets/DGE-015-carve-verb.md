# DGE-015: Carve: aim which way the cascade walks

## Status
Not started

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
