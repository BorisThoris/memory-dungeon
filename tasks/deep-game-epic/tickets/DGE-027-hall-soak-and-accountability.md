# DGE-027: Hall rooms, soak invariants and the accountability checklist for every mechanic

## Status
Done (2026-10-24): every mechanic the pack added answers to a census counter, walks twice in the hall, has its ledger entry and its writes read. New mechanics keep the same bar through CLAUDE.md's checklist and the gates that enforce it.

## Priority
P0

## Phase
Cross-cutting

## Subsystem
QA

## Depends on
- `DGE-001`

## Current repo context
- `src/shared/test-hall-rooms.ts` (`TEST_HALL_RESEEDS`, `TEST_HALL_CHECKED_ELSEWHERE`), `run-soak.ts`, `scripts/mechanic-accountability.ts` (`MECHANIC_CENSUS_EXEMPTIONS`), `system-refinement-ledger.ts`, `gameplay-interaction-graph-data.json`, the `/__hall` coverage panel.

## Problem
The pack adds thirteen mechanics. If their coverage is left to a later sweep it will not happen.

## Target experience
A standing ticket that each mechanic ticket points at, plus the shared work: a hall room template for the new seams, a soak player profile that uses the new verbs, and the census counters registered.

## Implementation notes
- Add a fifth soak player, "planned", who uses Hold, Carve and Echo and takes raging doors.
- A hall room authoring helper for two-layer and Fold boards.
- Keep the `/__hall` coverage panel's "mechanics without a room" list at zero at the end of every phase.

## Acceptance criteria
- Every mechanic in the graph from this pack has a room, two walks, a ledger entry, a census counter, and its writes read somewhere.
- `yarn gate:systems` is green at the end of every phase.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `test-hall-rooms.test.ts`, `run-soak.test.ts`, `mechanic-accountability.test.ts`.

## Risks and edge cases
- The hall e2e loads every room in a browser; thirty more rooms lengthen it; keep rooms small.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.

2026-10-21:
- **The planned player** (`SOAK_PLAYERS.planned`, `run-soak.ts`): misses one turn in ten, plays the elements, and holds for a stack of five before releasing (`holdRelease`); `run-soak.test.ts` requires a release of five. Taking raging doors was dropped: current runs travel to a seeded realm, there is no door to choose (doors retired with DGE-003). Carve and Echo join it when DGE-015 and DGE-019 land.
- **It found a softlock at once**: on a Layers floor the Hold can keep both halves of a lower pair under held cells, and the unlock lifted one card only. `promoteBeneath` now lifts until a pair is face down. No rules bump: the old behaviour was a stuck board, so no finished run's replay depends on it. Soak, five players x 200 seeds: 0 violations (planned: 4,937 floors).
- **Coverage**: every one of the graph's 77 mechanics is walked at least twice (`testHallChecksByMechanic`), the `/__hall` list of mechanics without a room is empty.
- **Census**: of the pack's mechanics only the Wanderers have a counter (run census, 0.383). Dread, the Warden, Endless rent, the Hold, the Fold and Layers carry argued exemptions in `mechanic-accountability.ts`, each naming why the census cannot see it (floors past 24, a verb the census players never press, a shape rather than an event) and what checks it instead. A census that plays floors 25-60 would retire most of them; that is DGE-032's ground.
- **Room helpers**: `layeredRoom` (two decks) is in `test-hall-rooms.ts`; a Fold room needs only `board: { fold }` on `room()`.

2026-10-22, the end of the pack's mechanic phase:
- **Carve and Reprise joined the planned player** as the 2026-10-21 note promised: `carveRate: 0.15` aims the next pop at random, and every player presses Reprise once its last turns were all matches. Deep soak with every Depth (`--floors=62 --depths`, 210 seeds x 5 players): planned 1,043 carves (718 spent) and 81 Reprises, careful 373 Reprises, 0 violations at every Depth.
- **Coverage**: the graph has 88 mechanics; every one is walked twice or named in `TEST_HALL_CHECKED_ELSEWHERE` (`progression.depths` joined it: a Depth is chosen before any board, so the soak's `--depths` and a unit test per rung check it). Each pack mechanic has a ledger entry and a census counter or an argued exemption; `gate:systems` green on every ship of the phase.
- Still open (why this ticket stands): the census plays floors 1-24, so the Act III/IV mechanics keep exemptions that a deep census would retire (DGE-032's ground).

2026-10-23, the deep census:
- `deep-census.ts` plays the run census's reference player through the game's own floor transition to floor 60 (24 seeds, 1,440 floors, twenty seconds) and watches seven deep counters; `gate:deep-census` in `gate:systems` fails if one never fires. The run census takes a counter list for it, and a counter may be a `state` (what the floor was dealt, read at its end).
- Seven exemptions retired for measured shares (`MECHANIC_DEEP_CENSUS_COUNTERS`), each quoted in the ledger and re-measured by its test: masks dropped 0.553 of a run's floors, Sleepers woken 0.124, the Dread's purchases 0.117, Spiral rings 0.031, the Keeper's swaps, the Cartographer's turns and the Warden's re-deals 0.017 each (one floor in sixty). Audit: 89 mechanics, 46 censused, 43 exempt, none unanswered.
- Still exempt, with reasons rewritten where they said "the census stops at 24": the learned rule (it reads the element matched most, and the census plays without a realm), and the verbs (Hold, Carve, Reprise: the reference player presses no tool; the soak's planned player counts them).

2026-10-24, the rest of the pack counted: the deep census now plays each seed in its own realm, at a Depth that walks the ladder (seed i at Depth i mod 21), past the Warden to floor 66 in Endless, and adds a planned player who holds and releases at four, carves now and then and reprises when it can (a census pass that runs only when a counter asks for it, so the 24-floor census is untouched). Eleven more exemptions retired for measured shares (12 seeds, 792 floors, 77 seconds; `gate:deep-census` in `gate:systems`): the Fold 0.121 of a run's floors, Layers 0.167, Dread at Awake 0.730, the learned rule 0.394, a Depth's rule 0.917, Endless rent owed 0.091, a boss door's reward in hand 0.032, an evolution in play 0.303, Hold releases 0.611, carves spent 0.485, Reprises 0.394; the first seven re-measured with the realm (masks 0.610, Sleepers 0.136, the Dread's purchases 0.730, Spiral rings 0.030, the Keeper, the Cartographer and the Warden 0.015 each). Audit: 89 mechanics, 57 censused, 32 exempt - all of them mechanics from before the pack - none unanswered.

