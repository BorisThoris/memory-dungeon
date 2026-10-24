# DGE-026: Boss rewards gated by door tier

## Status
Done (2026-10-21), rules 75: doors return before act bosses only (doors were retired between floors).

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

2026-10-21, built (rules 75):
- Doors had been retired (runs travel to a seeded realm), so there was no door to tier by. Asked, the owner chose "whatever is best for retention, from the research": autonomy predicts replay most strongly (`05-research-report-engineering-addiction.md`), and Dead Cells throttles boss blueprints by the tier the player opts into. So the doors come back on one clear only, the one before an act boss (24, 40, 60, each Endless act's last; the test pace's ladder counts), and the door taken tiers the reward.
- `src/shared/boss-reward-rules.ts`: `offersBossDoors`, `bossRewardFor` (calm: the clear; wild: `BOSS_WILD_GOLD` 12; raging: the next of `BLUEPRINT_ORDER`, gold once all are held), `applyBossReward` in `finalizeLevel`. The tier reads the boss floor's severity - the door sets it - so no `lastDoorTier` field. `RunState.blueprints` (in order) and `lastBossReward`. `isActBossFloor` in the schedule.
- UI: `RealmTravel` is mounted again, only for these doors: titled "Before the boss", each door with a Boss reward line (`bossRewardCopy.ts`); the clear beat says what the boss gave.
- Soak: the door invariant allows the boss doors; counters for boss doors and blueprints (5 x 200: 722 boss doors, 230 blueprints, 0 violations), invariant that blueprints drop in order and never twice. Three hall rooms. `gate:warden-reach` still green (56/100).
- Not done: the blueprints do nothing until DGE-014; save-level unlocks (Dead Cells keeps blueprints across runs) are not built - they stay on the run, as DGE-014's notes ask.

2026-10-24: the blueprints work since DGE-014 (six evolutions, all live). Blueprints kept across runs (Dead Cells' save-level unlocks) stay out, as DGE-014's notes ask: a blueprint is the run's reward from its boss door.
