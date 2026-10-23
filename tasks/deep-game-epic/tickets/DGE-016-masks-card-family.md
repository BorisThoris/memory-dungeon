# DGE-016: Masks: backs that lie until first flipped

## Status
Done (rules 80, 2026-10-21)

## Priority
P1

## Phase
3 · Act III

## Subsystem
Card family

## Depends on
- `DGE-009`

## Current repo context
- `ElementCardBack.tsx` (backs show the element), `board-tile-generation-rules.ts`, realm Frost's snowed-over backs in `realm-weather-rules.ts` as the model for a hidden suit.

## Problem
The suit map on the backs is the player's free information. Act III makes some of it unreliable, which adds a second thing to remember.

## Target experience
A few cards per Act III floor show a false element on their back. The first flip drops the mask for the rest of the floor. Priced 6 in the Dread table. The Unmasking Glass evolution drops masks at the study window.

## Implementation notes
- `mask-rules.ts`: `maskedIds` and `maskSuit` on `BoardState`; `unmask(tileId)` in the flip transition.
- Renderer: the back draws the mask suit; unmasking is a card-leaves-its-element effect in miniature (`cardElementFx.ts`).
- Counter `masksDroppedThisFloor`; Codex; graph; census.

## Acceptance criteria
- A masked card's cast on match uses its true element.
- Masks are never on both cards of one pair (a pair is findable by one honest back).
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall room "A mask drops"; soak; colour-vision gate for the mask mark.

## Risks and edge cases
- Generation change: `GAME_RULES_VERSION`.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.

2026-10-21, built (rules 80):
- `mask-rules.ts`: `dealMasks` (two masks a floor from 25, three from 33; one card of a pair, an element the floor holds that is not its own), `dropMask`, `unmaskOnFlip`, `unmaskBoard`. `Tile.mask` rather than board-level `maskedIds`, like `snowed` and `wanderer`; `RunState.masksDroppedThisFloor`.
- **The lie lives only in `playerVisibleTile`**: a hidden masked card is handed to the screen with `suit` set to its mask, the way a Turncoat shows its dealt element, so every renderer path draws the lie and every rule (cast, pop, reaction) reads the true element. No mark on a masked back: a marked lie is no lie. Colour-vision: the false back is an ordinary element back, glyph and all.
- Every path that turns a card face up drops it: `flipTile`, the Zone's flip, the auto-turned last pair (the soak found the Zone's: 36 violations before the fix). A pop can take a masked card unturned; its lie was never shown.
- The Unmasking Glass evolution is live: masks drop as the floor is dealt. Codex `sys_masks` and the evolutions entry; ENCYCLOPEDIA 107.
- The plan priced Masks at 6 on a Dread table that was never built; the price is a floor count here.
- Hall room `mask-drops` (the mask drops on a miss, the match casts fire not water); unit tests; soak invariant (never both cards, never face up, never its own element) and counters; soak 5 x 200: 7478 masks, 3511 dropped, 0 violations. warden-reach 56/100. Looked at in the isolated browser.
- Not done: the unmasking FX (`cardElementFx.ts` in miniature); the back simply turns to the truth.

2026-10-23: the unmasking FX. When a card turns to an element its back did not show (`unmaskedCells.ts`, read off two visible boards, which wear the mask as the suit), its truth breaks out of it as a spark burst in that element's colour (`TileBoardParticles`, counted as `data-particle-unmask-bursts`); the glass tick of DGE-030 plays with it. Unit-tested; seen in the isolated browser on the mask room (one burst on the flip, no console errors).
