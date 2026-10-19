# DGE-009: Wanderers: cards that drift and leave a trail

## Status
Not started

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
