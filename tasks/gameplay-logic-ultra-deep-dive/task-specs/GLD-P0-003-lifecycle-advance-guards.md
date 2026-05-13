# GLD-P0-003: Guard Level Advance To Completed Runs

## Status
Done

## Priority
P0

## Source Passes
Pass 01, Pass 20.

## Problem
`continueToNextLevel` and shared `advanceToNextLevel` can be called when the run is not `levelComplete`, allowing accidental floor skips and state resets.

## Proposed Behavior
- Store action must no-op unless `run.status === 'levelComplete'`.
- Shared rule function should either guard internally or expose a checked wrapper used by store.
- Existing legal relic/shop/route/side-room interludes must still advance through their intended routes.

## Acceptance Criteria
- Non-complete statuses cannot advance floors.
- Legal level-complete flow still works for normal route choice, relic offer, side room, and shop.

## Verification
- Store tests for `memorize`, `playing`, `resolving`, `paused`, `gameOver`, and `levelComplete`.
- Targeted gameplay tests around route/relic interlude advance.

## Implementation Notes
- Shared `advanceToNextLevel` and store `continueToNextLevel` now no-op unless the run is `levelComplete`.
- Puzzle clears remain terminal and do not enter procedural floor advance.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed shared `advanceToNextLevel` and store `continueToNextLevel` can be reached without a `levelComplete` guard.
- Confirmed puzzle runs currently use the same advancement path.
- Acceptance must cover both direct shared-rule calls and renderer store actions.
