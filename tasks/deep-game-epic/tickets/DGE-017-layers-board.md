# DGE-017: Layers: a second deck beneath the first

## Status
Done (2026-10-20), rules 72. Two decks under two cells in five, not every cell; no rise animation yet: see notes.

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

2026-10-20, built (rules 72):
- `src/shared/board-layers-rules.ts`: `BoardState.beneath` (the card under each cell, or null), `layerKey`, `spent`; `dealLayers` (last in the floor transition), `promoteBeneath`, `promoteRunBeneath`, `applyLayerTurn` (after the Wanderers, before the Warden), `cardsBeneath`. `allBoardCards` and `isBoardComplete` in `board-inspection.ts` read both decks.
- Not a `layers: Tile[][]`: the grid stays one array, and a rise moves the dealt card (its id unchanged) from `beneath[i]` into `tiles[i]`; the cleared card it rose over goes to `spent`, so its pair is still two cards to the inspector, the soak and the magpie (which now takes only pairs wholly on the grid). The renderer keys the floor on `layerKey`, every id both decks were dealt: a rise is not a new deal (verified, no veil).
- Where cards rise: after every resolved turn, and after the bomb, the meteor, the Crucible, the Hold's release and the three shuffles - every place a cell can clear or a card can move between turns. A held cell keeps its card until the release.
- **The lock**, found by the soak: cards move after the deal, so a card can come to sit over its own partner, or two over each other's, or the Hold can keep the cell over the last one's partner. Every lock has one shape - no whole pair face down on the grid while cards wait beneath - and then a waiting card whose partner is on the grid steps into the nearest cleared, uncovered cell (there always is one). Pinned by a unit test; the soak's invariants no longer excuse the Hold.
- Realm holds: what rises runs `releaseRealmHoldsIfStuck`, as any break does.
- **Two in five, not every cell**: `LAYERS_COVER` 0.5 took floors 37-39 to 24.3-24.8 turns, past the curve's 24 (`sim-difficulty-curve.ts`); 0.4 holds it. Floors are longer by design, by about a third.
- Renderer: `LayerEdges.tsx` (the edge of a card under every covered cell, ink and a paper rim, the same for every card - it says only that something waits), `Layers` in the key. `playerVisibleBoard` strips the lower deck to ids. No rise animation: the matched card leaves at once and the risen card is there.
- Rules 72 reseed: the Still Bell test accepts `empowered` (weather that meets only its own element), the version gate, fifteen ledger notes requoted.
- Checklist rows ticked: rules module, generation gate (`LAYERS_RULES_FROM`), hall rooms `layers-rise` / `layers-pop-risen` (three seeds), soak invariants (no cleared cell over a waiting card; a floor ends only when both decks are cleared) and counters, graph node `board.layers`, ledger entry, census exemption (the censuses stop at 24), Codex `sys_layers` (encyclopedia 101), a look in the browser.
- Not done: the rise animation and its reduced-motion swap; `yarn sim:endless --deep-floors` coverage; per-archetype lower-deck profiles (the lower deck is two seeded elements on every Layers floor).
