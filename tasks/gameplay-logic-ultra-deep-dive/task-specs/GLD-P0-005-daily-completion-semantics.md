# GLD-P0-005: Define Daily Completion Semantics

## Status
Done

## Priority
P0

## Source Passes
Pass 09, Pass 16.

## Problem
Daily completion appears to merge on daily `gameOver` regardless of whether the player cleared a floor. Copy says daily clears, and achievements/streaks can advance from failed attempts.

## Proposed Behavior
Define daily completion as one of:

- first daily floor clear,
- daily run ended after at least one clear,
- successful featured objective clear.

Recommended: count Daily completion on first floor clear, not on zero-clear game over. Persist archive state immediately at clear.

## Acceptance Criteria
- Zero-clear daily failure does not increment daily completion/streak/ACH_SEVEN_DAILIES.
- A successful daily clear updates daily archive according to the chosen policy.
- Copy uses the same term as the rule.

## Verification
- Store tests for failed daily game-over, cleared daily game-over, and cleared daily abandon.
- Achievement tests for seven daily completions.

## Implementation Notes
- Daily completion now records on the first successful daily floor clear, not zero-clear game over.
- Reusing the same daily key remains idempotent and does not double-count later end-run paths.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed daily completion currently merges on `gameOver`, not a clear-success policy.
- Confirmed seven-daily achievement eligibility reads the same completion count.
- Acceptance must include zero-clear failure, archive/streak behavior, and Daily meta-upgrade policy.
