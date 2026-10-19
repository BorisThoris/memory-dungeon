# DGE-010: The Fold: two rooms joined by a doorway

## Status
Not started

## Priority
P1

## Phase
1 · Act II

## Subsystem
Board

## Depends on
- `DGE-002`

## Current repo context
- `board-layout-rules.ts`, `board-grid-dimensions.ts`, `board-generation.ts`, `pop-reach-simulation.ts` (orthogonal reach), the WebGL board and camera fit in `GameplayScene.tsx`, `gameplaySceneFrame.ts`.
- Puzzle Bobble contact rule in the thesis: where you match decides what else leaves.

## Problem
Every floor is one rectangle, so position only matters locally. A second shape makes routing a decision.

## Target experience
Some Act II floors deal two rooms side by side with a two-cell doorway between them. A cascade crosses the doorway only when a match is made in a cell adjacent to it. Suits are dealt so each room leans to two suits, making the crossing worth planning.

## Implementation notes
- `board-layout-rules.ts`: a `FoldLayout` with two rectangles and a doorway; `reach` in `pop-reach-simulation.ts` treats the doorway as a gate with a `crossingAllowed` predicate set by the last match's cell.
- `board-grid-dimensions.ts` reports the bounding grid; `GameplayScene` camera fits the bounding box; the fit contract at 390x844 decides whether the Fold is portrait-stacked on phones.
- Deal profile: `SUIT_DEAL_PROFILE_BY_ARCHETYPE` gains `fold_hall`.
- Realm weather applies per room (a blizzard row slides inside one room).

## Acceptance criteria
- A match not adjacent to the doorway never cascades across it; one adjacent does (unit test).
- Every Fold floor is finishable: the inspector treats the doorway correctly.
- Fits every contract viewport.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `board-layout-rules.test.ts`; hall rooms "Cross the doorway" and "Blocked at the doorway"; `e2e/ui-fit-contract.spec.ts`; playtest screenshots.

## Risks and edge cases
- Every rule that walks neighbours (lantern, skittish, sticky fingers, element cast) must use the layout's adjacency, not grid arithmetic; grep for `columns` arithmetic before starting.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
