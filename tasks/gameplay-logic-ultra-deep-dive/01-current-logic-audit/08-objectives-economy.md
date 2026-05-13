# Pass 08: Objectives, Scoring, Economy

## Current Map
- Score combines match score, findables, route cards, dungeon cards, hazards, spotlight, objectives, streak, and boss multiplier.
- Shop gold comes from floor clears plus route, dungeon, event, trap, lock, side-room, and bonus sources.
- Favor converts every 3 progress into a banked relic pick.
- Baseline findables now spawn without `findables_floor`; that mutator increases density.

## Findings
- **P0/P1:** Dungeon objective counters for treasures/gateways are cumulative but are treated as current-floor progress, risking auto-completed future objectives.
- **P1:** Balance simulation undercounts wallet inflow because it omits many live reward sources.
- **P1/P2:** Featured objective reward copy has stale values.
- **P2:** Economy taxonomy docs understate current source/sink breadth.
- **P2:** Findable docs still imply mutator-gated pickups.
- **P2:** Destroy-charge reward copy conflicts across code, HUD, tests, and docs.

## Task Candidates
- Split/reset per-floor objective counters.
- Expand balance sim to route/dungeon/event reward paths.
- Centralize objective reward copy from constants.
- Refresh economy taxonomy and findable policy docs.

## Verification
- Tests for treasure/gateway objectives after prior-floor progress.
- Balance snapshots with scripted route/dungeon reward claims.
- Copy tests against exported objective score constants.

## Refinement Notes
- `Confirmed P1`: `loot_cache` and `claim_route` read cumulative counters, and `advanceToNextLevel` does not reset all relevant fields.
- `Confirmed P1`: balance simulation models shop gold narrowly and omits live route/event/room/reward inflows.
- `Confirmed`: featured objective copy is stale relative to runtime constants.
- `Confirmed`: destroy-charge stack policy conflicts across events, shop, rooms, inventory, clean-clear rewards, HUD copy, and tests.
- `Confirmed`: baseline findables are no longer only mutator-gated under current rules; the mutator forces density rather than sole availability.
