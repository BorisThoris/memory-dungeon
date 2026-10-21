# DGE-011: The Keeper of Halls, floor 24

## Status
Done (rules 81, 2026-10-22)

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

2026-10-22, built (rules 81):
- `keeper-rules.ts`: `swapRooms` (each left-room cell trades with the one a room's width right; a pinned card and its counterpart hold), `applyKeeperTurn` on every fourth resolved turn, counter `keeperSwapsThisFloor`. Hooked after the Hold and **before the Wanderers**, as the ticket's risk note asked (`board-turn-transition.ts`).
- Floor 24 is its own archetype, `keeper_hall` (the Warden's pattern: `FLOOR_ARCHETYPE_IDS`, the archetype copy, a clumped deal profile, the identity contract), from rules 81 only (`pickFloorScheduleEntry`), dealt as a Fold (`isFoldFloor` takes it though it is a boss floor). It keeps the spotlight and drops the restless drift: one rule that moves the board is the boss.
- Reward: the door taken before it (DGE-026): raging gives the next blueprint, as every act boss does.
- HUD: the board crown states the rule and the turns to the next swap; the identity contract states it before the first flip (teaching, counterplay, reminder). Codex `sys_keeper`, ENCYCLOPEDIA 108. Looked at in the isolated browser.
- Hall rooms `keeper-swap` ("Rooms swap on turn four") and `keeper-pin`; unit tests; soak invariant (a swap keeps the board's size and every pinned cell) and counters: 645 Keeper floors, 1817 swaps, 0 violations. Goldilocks exempts `keeper_hall` by name, as it does the Warden. warden-reach 58/100.
- Not done: boss key art and a stinger for the presentation slots (DGE-030).
