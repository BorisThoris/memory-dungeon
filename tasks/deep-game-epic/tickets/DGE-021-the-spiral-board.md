# DGE-021: The Spiral: a floor survived, not finished

## Status
Not started

## Priority
P1

## Phase
4 · Act IV

## Subsystem
Board

## Depends on
- `DGE-017`

## Current repo context
- `floor-par.ts`, `floor-clear-transition.ts`, `board-layout-rules.ts`, the floor-clear beat and objectives (`FEATURED_OBJECTIVE_LABELS`).

## Problem
Act IV should break the assumption that a floor ends when the board is empty.

## Target experience
Some Act IV floors are Spirals: each time the outer ring is cleared it is removed and a new inner ring is dealt. The floor ends when the par turn count is reached; score, not clearance, is the goal. Par is shown as the milestone fraction.

## Implementation notes
- `spiral-rules.ts`: ring detection, ring removal and inner deal; the clear condition becomes turns reached; par semantics flagged on the entry (`clearRule: 'turns'`).
- Objectives that assume clearance (`cursed_last`, `flip_par`) are excluded on Spiral floors by the schedule.
- Renderer: the ring collapses inward (what falls lands).

## Acceptance criteria
- A Spiral floor always ends; soak never sees an unbounded Spiral.
- The HUD states "survive N turns" and the fraction.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall room; soak invariant (Spiral floors terminate); screenshots.

## Risks and edge cases
- The miss bank still charges misses on a Spiral; the par is the only clock. Never a wall-clock timer.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
