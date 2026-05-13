# Pass 17: Shop, Economy, Inventory

## Design Map
- Shop APIs live in `game.ts`; `shop-rules.ts` re-exports.
- Shop v1 has fixed item list: heal, peek, destroy, iron key, master key.
- Gold sources are broader than floor clear: route, treasure, traps, caches, boss, events, bonus rooms.
- Run inventory is mostly a projection/read model; powers mutate run fields directly.
- Balance sim samples broad heuristics, not route traversal or purchase policy.

## Weak Spots
- Reroll restocks the same item list with new IDs, not a new stock mix.
- Floor-clear shops appear fixture-driven.
- Route “shop” side rooms fall back to bonus rewards unless fixtures inject offers.
- Safe side-room rest bypasses richer rest-shrine service catalog.
- Inventory transaction helpers are test-only.
- Balance sim is too broad for price tuning.

## Task Candidates
- Add deterministic shop stock pools by source/floor/route/node.
- Define floor-clear shop generation contract.
- Fix route shop handoff or rename shop side rooms.
- Unify or retire run inventory transaction helpers.
- Add economy event ledger for source/sink anti-duplication.
- Upgrade balance sim with route and purchase policies.

## Verification
- Real shop availability tests.
- Stock variation/reroll tests.
- Non-fixture route-shop e2e.
- Exploit tests for duplicate claims.

## Refinement Notes
- `Confirmed`: shop APIs still live in `game.ts`; `shop-rules.ts` is a re-export barrel.
- `Confirmed`: stock is fixed by source/level, and reroll changes IDs/cost state but not item mix for the same source/level.
- `Confirmed`: natural floor clears earn gold but do not generate offers; existing tests manually inject `shopOffers`.
- `Likely`: route "shop" is not modeled as a side-room vendor; side-room flow falls back to rest/event/bonus unless offers already exist.
- `Confirmed`: run inventory transaction helpers are exported but currently only test-used.
- Acceptance should define floor-clear shop intent, source-specific stock contract, reroll stock variation policy, non-fixture shop access, and source/sink ledger coverage.
