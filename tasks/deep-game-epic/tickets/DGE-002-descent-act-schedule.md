# DGE-002: Replace the twelve-floor cycle with the sixty-floor Descent schedule

## Status
Done (2026-10-19)

## Priority
P0

## Phase
0 · Spine

## Subsystem
Spine

## Depends on
- `DGE-001`

## Current repo context
- `src/shared/floor-mutator-schedule.ts`: `ENDLESS_FLOOR_CYCLE`, `CHAPTER_ACT_BIOME_STRUCTURE` (three acts of four floors inside the twelve), `POSITION_NINE_ROTATION`, `pickFloorScheduleEntry`, `FLOOR_SCHEDULE_RULES_VERSION = 4` with its bump checklist in the file header.
- `src/shared/floor-mutator-schedule.test.ts`, `floor-schedule-reachability.test.ts`, `authored-floors.ts`, `next-floor-run-state-rules.ts`.
- Breather floors are the trough the Tetris Effect finding asks for; they stay.

## Problem
Floor 40 resolves to the same schedule entry as floor 4. There is no second act, so nothing is new after floor 12 (the Wordle finding: repetition reads as a thwarted near-miss).

## Target experience
The run has four named acts (The Gate 1-12, The Living Dungeon 13-24, The Deep 25-40, The Abyss 41-60). Each act's schedule is its own authored list. Act I is the shipped cycle unchanged. Acts II to IV initially reuse Act I archetypes with their act's boss slot reserved, so this ticket ships before any new mechanic and the later tickets fill the slots in.

## Implementation notes
- Introduce `DESCENT_ACTS: readonly DescentActDefinition[]` with `id`, `title`, `firstFloor`, `lastFloor`, `schedule: FloorScheduleEntry[]`, `bossFloor`, and `dreadTierFloors`.
- `pickFloorScheduleEntry(level)` resolves the act first, then the entry; levels past 60 fall through to the Endless rule (DGE-006), which until then repeats Act IV.
- Keep `getChapterActBiomeForCycleFloor` working for Act I so `RunShell` copy and tests do not break; add an act-aware equivalent for the HUD.
- Bump `FLOOR_SCHEDULE_RULES_VERSION` to 5 and follow its four-step checklist. Do not bump `GAME_RULES_VERSION`: this is schedule-only.
- Reserve boss floors 24, 40 and 60 as `floorTag: 'boss'` entries carrying the existing Keystone Warden identity until DGE-011, DGE-018 and DGE-005 replace them.
- Keep the daily and pass-and-play on their current schedules (`runFollowsFloorSchedule`).

## Acceptance criteria
- A schedule test asserts, for every act after the first, at least one entry whose archetype, mutator set or floor tag does not appear in the act before (the "something new every act" bar). Until the mechanic tickets land, the reserved boss slots satisfy it; the test tightens as they land.
- Floors 1 to 12 produce byte-identical entries to today (a golden test over the old cycle).
- Every floor 1 to 60 is reachable and `floor-schedule-reachability.test.ts` passes.
- The progression rows the Codex reads (`progressionRowForEntry`) list all four acts.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `floor-mutator-schedule.test.ts` extended per the bump checklist; a golden test for Act I.
- `yarn sim:endless` over 60 floors; `yarn sim:curve` to 60.

## Risks and edge cases
- Saves in progress on the old cycle: `runRulesVersion` on `RunState` already pins a run to its rules; confirm a mid-run save on version 4 still resolves its floors.
- The appendix builder test (`mechanics-catalog-appendix-builder.test.ts -u`) will need its snapshot refreshed.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
2026-10-19:
- `DESCENT_ACTS` (four acts: The Gate 1-12, The Living Dungeon 13-24, The Deep 25-40, The Abyss 41-60), `DESCENT_FLOOR_COUNT = 60` and `descentActForFloor` live in `floor-mutator-schedule.ts`; `pickFloorScheduleEntry` resolves the act first. Each act's body keeps the cycle's entries on their own floors (golden snapshot `descent-schedule-golden.test.ts` pins floors 1-12 and 13/19/21/23/33/45/57/59 for twelve seeds on both branches of the seeded distraction channel); only the act boss floors changed.
- Reserved boss slots, stacked rooms carrying the Keystone Warden identity until their tickets land: floor 24 spotlight hunt with shifting spotlight + restless floor (DGE-011), floor 40 mirror hall with looking glass + skittish cards (DGE-018), floor 60 trap hall with sticky fingers + restless floor + looking glass (DGE-005). Boss floors raise a Colossus, so these are real fights already.
- Past floor 60 the Abyss repeats (floors 41-60 again, the Warden every twenty) until DGE-006 gives Endless its own rule.
- The "something new every act" bar is a test over mutator sets (an act after the first has a set the act before never had); tighten it as the act mechanics land.
- Corrections to this ticket's text: `FLOOR_SCHEDULE_RULES_VERSION` is compared with the run's *game* rules version, so the 4 -> 5 bump gates nothing; a rules-69 seed already shared meets the new boss floors. That is the schedule-only trade CLAUDE.md asks for (no `GAME_RULES_VERSION` bump). The Codex does not read `progressionRowForEntry`; the four acts reach it as a "The Descent" topic built from `DESCENT_ACTS` (encyclopedia 93).
- For DGE-003: the travel doors are retired (`RealmTravel` is test-only since 2026-10-07; `nextFloorRealmDoor` picks the realm). Dread's raging and wild multipliers have to come from the run's realm severity at each advance, not from a door choice.
- Checklist rows: schedule tests and golden test, the ledger requoted for floor 24 (the census plays 24 floors), appendix and Codex version, curve and run-census gates rerun. No new mechanic, so no graph node, census counter, hall room or soak invariant.
- Next: DGE-003 (Dread) and DGE-004 (milestone fractions), which can now read `descentActForFloor`.
