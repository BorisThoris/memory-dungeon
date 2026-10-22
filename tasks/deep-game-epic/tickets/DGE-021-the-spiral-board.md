# DGE-021: The Spiral: a floor survived, not finished

## Status
Done (rules 85, 2026-10-22)

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

2026-10-22, built (rules 85):
- `spiral-rules.ts`: floors 44 and 56 (the curve samples 40, 52, 60, never these) are `spiral_hall`, objective `scholar_style` (never `cursed_last`/`flip_par`). Rings outside in (`boardRings`). `sealSpiralRings`: a cleared live ring seals (`Tile.sealed`, off the board), one ring at a time, and fresh pairs are dealt into the cells of **whole** cleared pairs inside it - never a held seed's, never a Sleeper's - so every pair stays two cards and `matchedPairs` drops by exactly the pairs reused; pair count and par stay the floor's.
- **The floor always ends**: `applySpiralTurn` (outermost turn hook) survives the floor at par turns or when the last ring seals; `finalizeLevel` routes an empty board before par to seal-and-deal instead of the clear. The Hold's stack goes with the floor at par. A unit test plays a whole Spiral through the real turns and it ends by par.
- Sealed cells take nothing: the void spew and the Sleepers' wake skip them; a Sleeper a ring sealed stays down. The deep soak found all three interactions (orphan halves from dealing into half-cleared pairs; a Sleeper waking in a sealed cell; a refill over an asleep pair) before they shipped.
- HUD: the crown "Survive N turns: T of N" and the identity contract (`floorClearSentence` says survived). Codex `sys_spiral`, ENCYCLOPEDIA 112. Hall rooms `spiral-ring` ("The outer ring falls"), `spiral-par` ("Survive to par"), played on a calm realm so nothing pops. Looked at in the isolated browser.
- Deep soak to 62: 24 Spirals survived, 174 rings sealed, 0 violations. warden-reach 57/100.
- Risks: the renderer reflows the board's columns to the screen, and the rings follow the live column count, so a reflow mid-floor (a rotated phone) reshapes the rings sealed so far. The ring-collapse animation ("what falls lands") waits for DGE-030.
- Also: `bad-floor-is-quiet.test.ts` finishes a turn a trait left open; the wildfire hall room pins its rules version as well as its seed.
