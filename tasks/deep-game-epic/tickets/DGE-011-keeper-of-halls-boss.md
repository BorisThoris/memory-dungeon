# DGE-011: The Keeper of Halls, floor 24

## Status
Not started

## Priority
P1

## Phase
1 · Act II

## Subsystem
Boss

## Depends on
- `DGE-010`
- `DGE-026`

## Current repo context
- `boss-encounters.ts` identity and presentation slots; `looking-glass-rules.ts` as the model for a whole-board transform on a cadence.

## Problem
Act II needs a boss whose rule is the act's own idea, not a score multiplier.

## Target experience
Floor 24 is a Fold floor where every fourth resolved turn the two rooms swap sides (each card keeps its cell inside its room). Beating it on the raging door drops the Act II evolution blueprint (DGE-014); calm drops nothing extra.

## Implementation notes
- `keeper-of-halls-rules.ts`: `swapRooms(board)` on the cadence counter `keeperSwapsThisFloor`; hooked where the looking glass hooks.
- Boss identity row, HUD title, the three presentation slots filled (tag, risk note, named pressure).
- Reward through DGE-026's tier gate.

## Acceptance criteria
- The swap preserves every pair relationship and pins; the inspector holds.
- The rule is stated before the floor and the Codex carries it.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit tests; hall room "Rooms swap on turn four"; soak; playtest screenshots of the boss HUD.

## Risks and edge cases
- A swap and a Wanderer step on the same turn: define the order (swap first) and test it.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
