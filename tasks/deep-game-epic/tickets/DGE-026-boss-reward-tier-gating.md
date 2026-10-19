# DGE-026: Boss rewards gated by door tier

## Status
Not started

## Priority
P2

## Phase
5 · Meta

## Subsystem
Boss

## Depends on
- `DGE-003`

## Current repo context
- `RealmTravel.tsx` doors (calm, wild, raging; x1, x1.25, x1.5 gold), `boss-encounters.ts`, `RunState.blueprints` (DGE-014).
- Dead Cells finding: boss drops throttled by tier, nothing extra for skipping ahead.

## Problem
Rewards should pull the player up the door ladder one step at a time.

## Target experience
A boss drops its blueprint only when reached through a raging door; wild gives gold; calm gives the clear. Beating a later boss on raging without the earlier blueprint drops the earlier one first.

## Implementation notes
- `boss-reward-rules.ts`: `bossReward(run, bossId)` reading the door taken into the boss floor (tracked on `RunState.lastDoorTier`).
- The door screen states the boss reward tier when the next floor is a boss.

## Acceptance criteria
- Deterministic: the same run state yields the same reward.
- The blueprint sequence is in order regardless of which boss drops it.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; soak counter for blueprints by door; hall room.

## Risks and edge cases
- Seeded offers: `GAME_RULES_VERSION` with DGE-014.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
