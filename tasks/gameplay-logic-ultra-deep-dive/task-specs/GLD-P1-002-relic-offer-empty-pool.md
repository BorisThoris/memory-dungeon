# GLD-P1-002: Prevent Empty Relic Offer Blocking

## Status
Done

## Priority
P1

## Source Passes
Pass 06, Pass 15.

## Problem
`needsRelicPick` can allow a relic draft when eligible options are exhausted. `openRelicOffer` can then create an offer with zero options and positive picks remaining.

## Proposed Behavior
- Check eligible pool before opening an offer.
- If empty, skip the draft and advance, or convert the pick into a documented fallback reward.

## Acceptance Criteria
- No relic offer opens with zero options.
- Bonus-pick-heavy and Daily runs cannot block on exhausted pool.

## Verification
- Unit tests for exhausted pool, contract-filtered pool, Daily exclusions, and multi-pick exhaustion.

## Implementation Notes
- Initial exhausted relic offers skip the milestone rather than opening an empty draft.
- Relic offer services are unavailable or no-op when they would produce an empty blocking offer.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed initial `openRelicOffer` can create an empty offer.
- Confirmed later-round exhaustion after a pick already closes the offer and advances.
- Acceptance should cover initial open, service-generated offers, all-relic-owned, contract-filtered, Daily extra-pick, and bonus-pick-heavy cases.
