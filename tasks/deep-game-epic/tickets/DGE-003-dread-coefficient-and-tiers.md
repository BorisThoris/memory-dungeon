# DGE-003: Dread: one coefficient, named tiers on the HUD

## Status
Done (2026-10-23): Dread, its tiers, and the priced composition (rules 87).

## Priority
P0

## Phase
0 · Spine

## Subsystem
Spine

## Depends on
- `DGE-002`

## Current repo context
- Pattern: `src/shared/combo-heat-rules.ts` (`comboDepth`, `comboSoftCap`) for an unbounded driver; `realm-weather-rules.ts` for a clock the player winds; `RunShell.tsx` chips and `realmCopy.ts` for HUD words.
- Risk of Rain 2 finding: one coefficient, named tiers, priced composition (`../01-research-findings.md`).

## Problem
Nothing tells the player the dungeon is getting worse, and the floor builder has no budget to compose a deep floor differently from a shallow one.

## Target experience
A Dread bar on the run bar with eight named tiers (Quiet, Stirring, Restless, Hungry, Awake, Watching, It knows you, It is coming). The next tier's name is visible before it arrives. Dread rises with floor, is multiplied by raging doors, and never resets in a run. Floors are composed from a priced table paid with the Dread budget.

## Implementation notes
- `src/shared/dread-rules.ts`: `dreadForRun(run)` = linear in floor, x1.15 per raging door taken and x1.05 per wild, unbounded (reads like `comboDepth`: no plateau); `dreadTier(dread)` returns the tier and the fraction to the next.
- `RunState.dread` and `RunState.ragingDoorsTaken`; written in `next-floor-run-state-rules.ts` on each advance and in `RealmTravel` on a door choice.
- Priced table in `dread-rules.ts`: ordinary pair 1, (later) Wanderer 4, Mask 6, Sleeper 9, stacked mutator 12, boss rule 20. `board-build-rules.ts` takes a Dread budget and skips items cheaper than budget/20 once the budget exceeds 40, so deep floors are composed from the expensive rows. Until DGE-009 lands the only rows are pairs and stacked mutators.
- HUD: a `DreadChip` beside the realm chip in `RunShell.tsx`, tier name, a fraction bar, next tier name in the realm's colour; reduced-motion safe; spoken label.
- Doors in `RealmTravel.tsx` show the Dread each pays beside the gold multiplier.
- Codex entry and `ENCYCLOPEDIA_VERSION` bump.

## Acceptance criteria
- Dread is monotonic within a run and a test walks it to floor 1000 asserting it never stands still (AGENTS.md §2 pattern).
- Tier boundaries are a table in one place and the HUD, the Codex and the results screen read the same table.
- A floor built at Dread 80 contains no item priced under 4 while a floor at Dread 10 does (board build test).
- The chip fits every viewport in `ui-fit-contract.spec.ts`.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `dread-rules.test.ts`; `board-build-rules.test.ts` budget cases; `RunShell.test.tsx` chip render; a hall room "Dread rises through Stirring" naming the graph node.
- Soak invariant: Dread never decreases across a run.

## Risks and edge cases
- Changing board composition by Dread changes generation, which is a `GAME_RULES_VERSION` bump; batch it with DGE-009 if possible to avoid reseeding baselines twice.
- A tier name on the HUD must not become a hidden difficulty adjustment: Dread is a function of floor and doors only, never of the player's performance (thesis §25.13).

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
2026-10-19:
- `src/shared/dread-rules.ts`: `dreadAt(floor, raging, wild)` = 3 x floor x 1.15^raging x 1.05^wild, `dreadForRun`, `dreadTier` (tier, next, fraction, and `beyond`: doublings past "It is coming", without end), `DREAD_TIERS` (Quiet 0, Stirring 8, Restless 30, Hungry 75, Awake 160, Watching 320, It knows you 1500, It is coming 7000). The priced table (pair 1, Wanderer 4, Mask 6, Sleeper 9, stacked mutator 12, boss rule 20) is not in source yet: an export nothing reads fails `audit:test-only-exports`, so DGE-009 adds it with its reader.
- The doors are retired, so "per raging door taken" became "per raging floor entered": `RunState.dreadRagingFloors` / `dreadWildFloors`, counted in `enterRealmFloor`, which both run creation and every advance go through (the first floor counts). Severities are seeded at the clear by `rollRealmDoors` and a sway tip keeps the severity, so play never moves Dread (thesis 25.13). Dread itself is derived, not stored.
- Tiers were set from a 200-seed probe: median 19 at floor 5, 73 at 12, 310 at 24, 1450 at 40, 7200 at 60. Floor 2 is always Quiet (at most 6 x 1.15^2 = 7.9) and floor 3 always Stirring, which the hall room "Dread stirs" walks.
- HUD: `hud-dread` inside `hud-floor` (tier, a thin bar in the realm's colour filling toward the next tier's name; tier only on phone layouts; past the last tier a Roman numeral, so the floor number stays the only digit in `hud-floor`). Results: `game-over-dread` ("Dread: Watching"). Codex: "Dread" topic built from `DREAD_TIERS` (encyclopedia 94). All three read the one table.
- Not done, on purpose: the board builder spending a Dread budget (and its acceptance case "a floor at Dread 80 has nothing priced under 4") changes generation, a `GAME_RULES_VERSION` bump; the ticket's own risk note batches it with DGE-009, whose Wanderer, Mask and Sleeper are the only rows that make the budget matter. The prices are listed above for it. The door display in `RealmTravel.tsx` is dead code (test-only since 2026-10-07) and was dropped.
- Checklist rows: graph node `progression.dread` (enabled by realm travel, `displays` to the HUD), ledger entry, census exemption (it acts on nothing in a floor), mechanic count 71, soak invariant "Dread never falls, and every descent raises it" plus a report that some run reaches Hungry, hall room, Codex. No rules bump, no reseed.

2026-10-23, the priced composition (rules 87; the owner's choice: layered on the schedules).
- `dread-composition-rules.ts`: the plan's table (pair 1, Wanderer 4, mask 6, Sleeper 9, stacked mutator 12, boss rule 20). The floor schedules stay the minimum, so the Depth rungs keep their meaning. From Awake the Dread is a budget of six points a doubling, spent round the families the floor already deals, dearest first, at most two more of each; a family under an eighth of the budget is too cheap and skipped. Measured on the table: at Awake one mask or one Wanderer; at the floor-60 median (Dread ~7,200) two more Sleeper pairs and two more masks and no Wanderers. Mutators and boss rules are not for sale (the schedule places them).
- The dealers take an `extra` count over their schedule (`wandererCountFor`, `maskCountFor`, `sleeperCountFor`); `RunState.dreadBought` keeps the purchase, told on the board crown (`dread-bought`) before the first flip.
- Checks: unit tests on the table; a soak invariant on every descent (the floor was told what its Dread buys, and holds no more of a family than schedule plus purchase); the deep soak to 62 bought 14,341 across five players with 0 violations once the Spiral fix below landed. `gate:warden-reach` after the reseed: 57 of 100 at 15% misses (bar 50). Graph `board.dread_composition`, ledger, census exemption, hall exemption, Codex "The Dread spends" (ENCYCLOPEDIA 118).
- Found by the soak: a Spiral ended (last ring or par) with a Sleeper still asleep left it on the cleared floor; it now goes with the floor, as a held stack does. No play changes (the next floor starts with none).
