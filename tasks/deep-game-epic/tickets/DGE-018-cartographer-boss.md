# DGE-018: The Cartographer, floor 40

## Status
Not started

## Priority
P1

## Phase
3 · Act III

## Subsystem
Boss

## Depends on
- `DGE-017`
- `DGE-026`

## Current repo context
- `looking-glass-rules.ts` (reflection on a match cadence), `boss-encounters.ts`.

## Problem
Act III's boss should test the map in the player's head across both layers.

## Target experience
Floor 40 is a Layers floor dealt face-up for the study window; every third match the lower layer rotates a quarter turn. Raging drops the Act III blueprint.

## Implementation notes
- `cartographer-rules.ts`: `rotateLowerLayer(board)` on `matchResolutionsThisFloor % 3`; hooked beside the looking glass.
- Identity row, HUD, Codex, reward through DGE-026.

## Acceptance criteria
- Rotation preserves pairs and pins; inspector holds; rule stated before the floor.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall room; soak; screenshots.

## Risks and edge cases
- Rotation of a non-square lower layer: define it as rotation of the bounding square with wrap, and test odd dimensions.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
