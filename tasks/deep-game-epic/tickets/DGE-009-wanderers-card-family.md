# DGE-009: Wanderers: cards that drift and leave a trail

## Status
Done (2026-10-20), rules 70; the Dread price landed with the priced table (rules 87, 2026-10-23). No back mark (the owner’s rule wins).

## Priority
P0

## Phase
1 · Act II

## Subsystem
Card family

## Depends on
- `DGE-002`
- `DGE-003`

## Current repo context
- Movement seams and exemptions: `restless-floor-rules.ts`, `skittish-cards-rules.ts` (pinned exempt, partner exempt), `board-tile-generation-rules.ts`, `board-build-rules.ts`, tile traits and rail marks (`tile-trait-palette`), `color-vision.ts`.
- Curiosity finding: intermediate uncertainty, half-remembered, never a reshuffle.

## Problem
The late game needs a memory task that is harder in kind, not in count, and that stays in the half-known band.

## Target experience
From Act II two or three pairs per floor are Wanderers. Every third resolved turn each Wanderer card moves one orthogonal cell into a face-down, unpinned cell, and leaves a footprint on the cell it left for one turn. Their backs carry a wanderer mark (shape, not colour alone). Priced 4 in the Dread table.

## Implementation notes
- `src/shared/wanderer-rules.ts`: `wanderStep(board, rng)` seeded, pinned cards and the just-matched pair exempt, each card at most one step per tick; `BoardState.wandererIds`, `BoardState.footprints` (cell, turnsLeft).
- Hook after the restless drift in both seams so a restless floor and Wanderers compose deterministically; document the order in the module header and `MUTATORS.md`.
- Deal: `board-build-rules.ts` buys Wanderers from the Dread table; the hall room pins the count.
- Renderer: a footprint decal on the cell from the ambient atlas; the mark on the back in `ElementCardBack.tsx`; reduced motion shows the footprint without the slide.
- Counters `wandererStepsThisFloor`; Codex entry; graph node; census counter; ledger entry.

## Acceptance criteria
- A Wanderer never moves onto a pinned, face-up or occupied cell and never swaps with its own partner.
- A footprint is visible for exactly one turn in the hall room script.
- The board inspector's "a way left to finish" holds across 200 soak seeds with Wanderers on every Act II floor.
- The mark passes the three colour-vision gates and is spoken in the tile's accessible label.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `wanderer-rules.test.ts`; hall room "Wanderers step on turn three" walked at its seed and `TEST_HALL_RESEEDS`; `yarn sim:endless` on at least two floors; soak invariant.

## Risks and edge cases
- Generation change: `GAME_RULES_VERSION` bump, batched with DGE-003 if possible.
- Three movement systems on one floor (restless, skittish, Wanderers) could read as chaos; the Goldilocks probe in DGE-032 caps how many may be active on one floor.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.

2026-10-20, built (rules 70):
- `src/shared/wanderer-rules.ts`: the deal (`dealWanderers`, from the floor transition after the odd cards), the step (`resolveWandererSteps`, `applyWandererSteps`), the turn hook (`applyWandererTurn`, after the Hold and before the Warden in `board-turn-transition.ts`), `wandererFootprintCells`.
- The footprint is a flag on the card traded into the vacated cell (`Tile.footprint`), wiped by the next resolved turn, not a list of cells on the run: every renderer path that paints a card's status reads it without an index. A card shuffled between turns carries its footprint with it until the next turn.
- **Deviation:** the plan put a wanderer mark on the backs. The owner's rule (`player-visible-board.ts`, 2026-10-08) is that nothing face down may set one pair apart, so `wanderer` is stripped face down like the Turncoat's fields. The key beside the board (`OddCardLegend`) says Wanderers walk the floor; the focused card's label says "a Wanderer" face up and "footprint" on a trail card.
- The deal is by act (two from 13, three from 25), not bought from the Dread table: the priced table is still to be built.
- The rules bump reseeded the seeded tests: the Crucible's fixture now leaves the odd cards out of "the rest of the element" (the rule always did), the Hold test's helper skips a pair whose flip a trait refuses, the schedule golden is pinned at the rules it was recorded at (69), and twelve ledger notes were requoted.
- Soak: 200 seeds x 4 players, 8,461 Wanderer floors, 21,664 steps, 0 violations with the invariant that a footprint lies one step from a Wanderer on the turn it is left and none outlasts a floor. The first soak caught a release that cleared a floor showing last turn's footprints (fixed: every turn and every floor end wipes them).
- Checklist rows ticked: rules module, generation gate (`WANDERER_RULES_FROM`), hall room `wanderers-step` (three seeds), soak invariant and counters, run census counter `wandererSteps`, graph node `board.wanderers` with `displays` and `synergy` edges, ledger entry, Codex `sys_wanderers` (encyclopedia 99), `docs/MUTATORS.md` order note, a look in the browser.
- Not done: the slide animation and its reduced-motion variant (cards glide as any permutation does), `yarn sim:endless` coverage, the DGE-032 cap on movers per floor.

2026-10-23: the Dread now buys Wanderer pairs at 4 points on floors that deal them (DGE-003 notes); the Depth rungs still move the schedule underneath.
