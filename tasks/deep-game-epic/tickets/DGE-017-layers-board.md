# DGE-017: Layers: a second deck beneath the first

## Status
Not started

## Priority
P0

## Phase
3 · Act III

## Subsystem
Board

## Depends on
- `DGE-010`

## Current repo context
- `board-generation.ts`, `board-tile-generation-rules.ts`, `BoardState.tiles`, the memorize window (`getMemorizeDurationForRun` in `run-creation-rules.ts`), `pair-curve.ts`.
- Curiosity finding: the board must not be fully known at the study window.

## Problem
Floor 52 is the board's ceiling in width. Depth grows the problem without growing the grid.

## Target experience
Act III floors are dealt two decks deep. Clearing a pair reveals the two cards beneath, which belong to a narrower palette (two suits), so the deepest chains of the run live in the lower layer. The lower layer is never shown at the study window.

## Implementation notes
- `BoardState.layers: Tile[][]` or a `beneath` map; the clear seam promotes the lower cards into the vacated cells, face-down, with a reveal flash.
- Par: the floor par counts both layers (`floor-par.ts`).
- Renderer: a lower-layer edge visible under each top card; promotion animation; reduced motion shows the swap.
- Deal profiles for the lower layer in `SUIT_DEAL_PROFILE_BY_ARCHETYPE`.

## Acceptance criteria
- Every Layers floor is finishable: the inspector reasons over both layers.
- Pop reach treats a promoted card as face-down and unknown.
- Fits the viewport contract; tile type size audit passes.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall rooms "A pair reveals two beneath" and "Lower layer chain"; `yarn sim:endless --deep-floors`; soak.

## Risks and edge cases
- The biggest renderer change in the pack; prototype in the hall before touching the schedule.
- Generation change: `GAME_RULES_VERSION`.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
