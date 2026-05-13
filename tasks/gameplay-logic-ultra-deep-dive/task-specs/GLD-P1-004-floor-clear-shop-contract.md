# GLD-P1-004: Define Floor-Clear Shop Contract

## Status
Done

## Priority
P1

## Source Passes
Pass 07, Pass 17.

## Problem
Floor-clear shop UI exists, but normal floor clear appears not to generate `shopOffers`; tests/fixtures manually inject offers.

## Proposed Behavior
Floor-clear summary shops are only available when an existing stock source has already populated `shopOffers`. Ordinary floor clears earn shop gold but do not auto-generate offers.

Natural stock sources:

- Board/shop tile reveal creates in-floor shop offers.
- Route/shop or side-room shop paths may arrive with existing offers.
- Fixture/dev paths may inject offers for targeted coverage.

## Acceptance Criteria
- A non-fixture run can naturally reach shop if product says it should.
- Shop side-room and board-shop semantics are explicit.

## Verification
- `yarn vitest run src/renderer/store/useAppStore.test.ts src/shared/playable-path-fixtures.test.ts`
- `yarn typecheck:shared`
- `yarn test`

## Implementation Notes
- `openShopFromLevelComplete` remains guarded by `run.shopOffers.length > 0`, so an ordinary level-complete run with empty offers stays on the floor summary.
- Added store regression coverage for the empty-offer floor-clear case.
- Existing board-shop and playable-path fixture coverage confirms natural/shop-route stock still opens shop views when offers exist.

## Refinement Evidence
- Confirmed natural floor clears earn gold but preserve empty `shopOffers`.
- Confirmed current tests manually inject `createRunShopOffers`.
- Acceptance must declare shop cadence/eligibility and source-specific stock contracts for floor-clear, board, and route/shop sources.
