# DGE-016: Masks: backs that lie until first flipped

## Status
Not started

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
