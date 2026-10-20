# DGE-010: The Fold: two rooms joined by a doorway

## Status
Done (2026-10-20), rules 71. Per-room weather and the phone’s stacked fold are left: see notes.

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

2026-10-20, built (rules 71):
- `src/shared/board-fold-rules.ts`: `BoardFold` (`afterColumn`, `doorRows`), `foldCutsEdge`, `foldDoorCells`, `foldDoorOpenFor`, `foldRoomOf`, `isFoldFloor`, `foldFor`, `foldBoard`. Not a `FoldLayout` of two rectangles: the grid stays whole, every index row-major and every pair two cards, and the wall is a cut in adjacency. That kept the inspector, pair counts and every `row * columns + col` in the renderer untouched.
- Not an archetype either: `fold_hall` in the rotation would have moved every later floor's archetype. The Fold overlays the schedule on cycle floors 4 and 11 from floor 13, never a boss floor, and `foldBoard` runs in the floor transition before the realm, the odd cards and the Wanderers.
- The lean: each room is given two elements (the 1st and 3rd largest left, the 2nd and 4th right) and 70% of the cards dealt into the wrong room trade places with one the other room does not want. Cards keep faces and pairs; partner spacing mostly stands. Measured: rooms read like 7|1 and 1|7 per element.
- Adjacency: `orthogonalNeighbours`/`diagonalNeighbours` (`chunk-break-rules.ts`) and `orthogonalNeighbourIndices` (`skittish-cards-rules.ts`) take an optional fold, each keeping its own neighbour order, so a board without a fold walks exactly as before. Threaded through the pop (contact walk and bridges), `findSuitRegion`, the casts (`castElement`, `cardsWithinReach`, `elementalContactGroups`), `castElementalGround`, the lantern, the realm's spread, skittish, the match cleanup and the Wanderers (now on the shared helper, same order). The deal's own adjacency (`tile-suit-rules`, `tile-trait-rules`) runs before the fold exists and is unchanged.
- The gate: the pop's contact walk and the reaction burst (which picks the nearest pairs by distance) cross the doorway only when a matched card stands in a door cell. The drop - a suit left with no pair to pop loses its plain pairs anywhere - is mercy, not a cascade, and still crosses.
- `canReflowRunBoard` refuses a Fold board, so the responsive layout and the store never re-wrap it. At 390x844 the 6x4 hall room fits; the real Fold floors are 6x6 and 7x6. A portrait-stacked fold (the wall horizontal on phones) was not built.
- Renderer: `FoldWall.tsx` (a stone strip in the gap between the rooms' columns, open on the door rows with a post each side), and `The Fold` heads the key beside the board.
- Rules 71 reseed: the Storm Glass test accepts either of fire's peaks (the test already said the deal decides), the version gate, fifteen ledger notes requoted. The schedule golden stays at 69.
- Mutation test: with the door gate removed and then with the wall removed, the 40-seed soak still reported nothing. The soak's invariant is kept (it is correct) but it is not the proof; `board-fold-rules.test.ts` and the hall rooms `fold-cross` / `fold-blocked` are.
- Checklist rows ticked: rules module, generation gate (`FOLD_RULES_FROM`), hall rooms (three seeds), soak invariant and counter, graph node `board.fold` (`modifies` the pop, `displays`), ledger entry, census exemption (argued), Codex `sys_fold` (encyclopedia 100), a look in the browser at two sizes.
- Not done: per-room weather (a blizzard row or a column sweep still crosses the wall), d-pad focus crossing the wall (it is navigation, not a rule), distances measured across the wall (proximity hints, the meteor's radius).
