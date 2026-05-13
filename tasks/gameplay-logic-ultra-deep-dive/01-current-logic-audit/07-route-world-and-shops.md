# Pass 07: Route World, Shops, Side Rooms

## Current Map
- Floor clear generates route choices and dungeon nodes.
- Choosing Safe/Greed/Mystery applies immediate consequences and stores `pendingRouteCardPlan`.
- `advanceToNextLevel` consumes the plan into board generation.
- Route-world profile stamps route specials; side rooms can open after route commit.
- Shops have catalog, reroll, purchase, and board-shop hooks.

## Findings
- **P0/P1:** Floor-clear shop loop appears fixture/manual only; normal floor clears add gold but do not generate `shopOffers`.
- **P1:** Route outcome is not idempotent in shared rules; store blocks double choice but shared function can reapply rewards.
- **P1:** Safe route can double-heal through immediate route recovery and free rest side room.
- **P1:** Run-event destroy charge is capped while other destroy sources are uncapped.
- **P1/P2:** Route node, side-room, and run-map semantics are split across schedulers and can drift.
- **P2:** Route-world docs still call implemented generation “future.”

## Task Candidates
- Decide and wire/retire normal floor-clear shops.
- Add shared idempotency guard for route choice.
- Balance Safe recovery and update copy.
- Centralize route node/side-room derivation.

## Verification
- Non-fixture floor-clear shop test.
- Route idempotency tests.
- Matrix comparing selected node kind, side-room kind, and generated board.

## Refinement Notes
- `Confirmed P1`: natural floor clears add gold but do not stock `shopOffers`; tests manually inject offers.
- `Confirmed`: shared `applyRouteChoiceOutcome` lacks an idempotency guard, while the store guards double route choice.
- `Confirmed`: Safe route can heal immediately and then heal again through Safe rest.
- `Confirmed`: route node, side-room, and run-map kind can drift, including greed floor 5 `treasure` vs `trap`.
- `Confirmed`: route "shop" side rooms currently fall through to bonus reward behavior unless offers already exist.
