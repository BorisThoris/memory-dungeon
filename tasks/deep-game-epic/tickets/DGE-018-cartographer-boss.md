# DGE-018: The Cartographer, floor 40

## Status
Done (rules 82, 2026-10-22)

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

2026-10-22, built (rules 82):
- `cartographer-rules.ts`: `rotateLowerLayer` turns the lower deck a quarter, clockwise, ring by ring (`boardRings`, outside in): each ring carries its cards a quarter of its length round. On a square board that is a quarter turn exactly (tested on 3x3); on any other shape it is the ticket's "rotation with wrap" and always a bijection (tested on 5x3, 4x7, 6x1, 7x4). A cell under a pinned card holds; the top deck never moves. `applyCartographerTurn` on every third match, after the Keeper and before the Wanderers; counter `cartographerTurnsThisFloor`.
- Floor 40 is its own archetype, `cartographer_hall` (from rules 82), the one boss floor dealt two decks deep (`isLayersFloor`). The looking glass and the flinch left it: one board-mover is the rule. Its lower deck covers one cell in four (`LAYERS_CARTOGRAPHER_COVER`): at two in five floor 40 ran 25.3 turns, over the curve's 24; now 22.6.
- **"Dealt face-up for the study window"** is the chart: during memorize the lower deck's elements show on each waiting edge (`playerVisibleBoard(board, { chartBeneath })`; `LayerEdges` fills the edge with the element's frame colour - a tinted rim alone read the same as a plain one). Never its face or its pair.
- HUD: the board crown states the rule and the matches to the next turn; the identity contract states it before the first flip. Codex `sys_cartographer`, ENCYCLOPEDIA 109. Looked at in the isolated browser, study and play.
- Hall rooms `cartographer-turn`, `cartographer-pin`; unit tests; soak invariant (a pinned cell keeps its card beneath) and counters: 52 Cartographer floors, 161 turns, 0 violations. `sim-endless`'s coverage top-up now searches every act boss floor, not only 1-36 and 60. Goldilocks exempts it by name.
- warden-reach 51/100 at 15%, just over the bar; it has drifted 61 to 51 over DGE-023..018, worth watching.
- Known: on a boss floor the crown overlaps the "Memorize" heading during study (the Warden's crown did already).
