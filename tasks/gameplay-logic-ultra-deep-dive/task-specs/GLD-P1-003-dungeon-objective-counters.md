# GLD-P1-003: Split Per-Floor Dungeon Objective Counters

## Status
Done

## Priority
P1

## Source Passes
Pass 08.

## Problem
`dungeonTreasuresOpened` and `dungeonGatewaysUsed` appear cumulative but are read as current-floor progress for objectives and tags. Prior-floor progress can auto-complete future objectives.

## Proposed Behavior
- Split cumulative lifetime/run stats from per-floor objective counters.
- Reset per-floor counters on `advanceToNextLevel`.
- Use per-floor counters for `loot_cache`, `claim_route`, and level-result tags.

## Acceptance Criteria
- Opening treasure/gateway on floor N does not complete floor N+1 objectives.
- Run-history/cumulative stats remain available if intended.

## Verification
- Tests for treasure/gateway objective floors after prior progress.
- Regression for objective score/Favor not awarded from stale counters.

## Implementation Notes
- Treasure and gateway objective/status reads now use per-floor counters while cumulative run counters remain available.
- Per-floor treasure/gateway counters reset on floor advance and feed result tags.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed `loot_cache` and `claim_route` read cumulative run counters.
- Confirmed `advanceToNextLevel` resets many per-floor fields but not all counters used by these objectives.
- Acceptance must include secondary-objective/result tags, not only `getDungeonObjectiveStatus`.
