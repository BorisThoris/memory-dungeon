# Epic: Route world pipeline

## Scope

Route choice should become a gameplay/world-generation input, not just a between-floor UI choice or a decorative card marker. This epic owns the route pipeline from `RouteNodeType` and `pendingRouteCardPlan` through next-floor board generation, route-specific card families, side-room hooks, relic/perk synergies, and renderer-visible board outcomes.

Primary theory sources:

- [Route world pipeline](../gameplay-theory/ROUTE_WORLD_PIPELINE.md)
- [Card types, hazards, and pickups](../gameplay-theory/CARD_TYPES_HAZARDS_AND_PICKUPS.md)
- [Perks, relics, modifiers, and world interactions](../gameplay-theory/PERKS_RELICS_MODIFIERS_AND_WORLD_INTERACTIONS.md)
- [Synergy and anti-synergy matrix](../gameplay-theory/SYNERGY_AND_ANTI_SYNERGY_MATRIX.md)

## Design intent

When a player chooses a route, the next floor should visibly answer that choice.

| Route | Board/world promise |
|---|---|
| Safe | Lower volatility, defensive cards, guard/reveal/recovery support, fewer route-added hazards. |
| Greed | Higher payout, more traps or reward-risk cards, richer gold/favor/cache opportunities, stricter extraction. |
| Mystery | Deterministic uncertainty: veils, hidden side-room hooks, fair reveals, secret/event synergy. |

The route should bias the scheduled floor instead of replacing it. A Greedy `trap_hall` should be a more dangerous and more lucrative trap hall; a Safe `rush_recall` should remain a boss-pressure floor with a defensive pressure valve; a Mystery `treasure_gallery` should introduce uncertainty around reward identity or secret-room discovery.

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Route choice UI | **Functional** | Existing route choices select Safe/Greed/Mystery and persist through shop via `pendingRouteCardPlan`. |
| Route card rendering | **Functional** | `Tile.routeCardKind` drives DOM/WebGL/card texture markers. |
| Route reward on match | **Functional** | Route card pair can pay route-specific reward on successful match. |
| Route world profile | **Functional** | `RouteWorldProfile` now feeds next-floor board generation and is stored on `BoardState`. |
| Greed hazard/reward pressure | **Functional** | Greed route stamps extra reward-risk specials (`greed_cache`, `greed_toll`, `fragile_cache`) on eligible real pairs. |
| Safe support/ward behavior | **Functional** | Safe route stamps ward support (`safe_ward`, `lantern_ward`) and avoids route-added hazard pressure. |
| Mystery veils/reveal rules | **Functional** | Mystery route stamps deterministic veil/secret/mimic families; reveal tools turn suspicion into controlled claims before punishment. |
| Side-room route hooks | **Functional** | Route choice can open deterministic side-room interludes before shop/relic/next-floor flow. |
| Route-aware relic weighting | **Functional** | Relic drafts use pending and active route context for weight-only reasons without forcing route slots. |
| Boss/elite board anchors | **Functional** | Boss floors stamp `keystone_pair`; hard non-boss route floors stamp `elite_cache`, `final_ward`, or `omen_seal` by selected route. |

## Primary code

- `src/shared/contracts.ts` - `RouteNodeType`, `RouteCardKind`, `RouteCardPlan`, `Tile.routeCardKind`, `RunState.pendingRouteCardPlan`.
- `src/shared/game.ts` - route choice handling, `advanceToNextLevel`, `buildBoard`, route-card assignment, match/destroy resolution.
- `src/shared/floor-mutator-schedule.ts` - scheduled floor identity that route profiles should bias, not replace.
- `src/shared/run-map.ts`, `run-events.ts`, `rest-shrine.ts`, `bonus-rewards.ts`, `boss-encounters.ts` - side-room and encounter systems route-world should eventually reference.
- `src/renderer/components/TileBoard*.tsx`, `tileTextures.ts`, `GameScreen.tsx`, `ShopScreen.tsx` - rendering/copy surfaces for route-world state.

## Rough edges

- Current Greed selection now changes board metadata and named reward-risk families; higher-danger trap families are still future work.
- Destroy, peek, shuffle, tile swap, pin, and stray interactions have v1 policy for shipped route specials; future card families still need per-family tests.
- Mystery must be deterministic and fair: reveal before punishment, seed-replayable outcomes, and clear summary copy.
- Safe must not become the best economy route; it should pay in stability, streak preservation, and recovery.
- Greed must use real danger or reward denial, not only bigger numbers; side-room rewards stay capped by the bonus ledger.
- Route-aware relic drafts nudge odds and reason copy only; hard mutator/wager pressure still owns deterministic spotlight picks.
- Route-world changes that affect generation/scoring/replay should bump `GAME_RULES_VERSION` as appropriate.

## Tasks

Tracked in [GP-ROUTE-WORLD.md](../gameplay-tasks/GP-ROUTE-WORLD.md).

- [x] `GP-RW01` - Route world profile v1.
- [x] `GP-RW02` - Greed route board pressure.
- [x] `GP-RW03` - Safe route support and ward behavior.
- [x] `GP-RW04` - Mystery route veils and fair reveal.
- [x] `GP-RW05` - Route-world copy surfaces.
- [x] `GP-RW06` - Route card action interaction rules.
- [x] `GP-RW07` - Named card family prototype.
- [x] `GP-RW08` - Side-room route hooks.
- [x] `GP-RW09` - Route-aware relic/perk weighting.
- [x] `GP-RW10` - Boss/elite board anchors.
- [x] `GP-RW11` - Route synergy fixtures and regression matrix.
- [x] `GP-RW12` - Catalog, Codex, and docs coverage.
