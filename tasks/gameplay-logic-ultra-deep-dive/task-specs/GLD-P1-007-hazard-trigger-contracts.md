# GLD-P1-007: Hazard Trigger Contracts

## Status
Done

## Priority
P1

## Problem
Mirror Decoy copy implied first-reveal trigger while runtime counted mismatch paths, and Shuffle Snare lacked targeted coverage for repeat/cursed interactions.

## Implemented Behavior
Mirror Decoy hazard counters trigger on mismatch involvement, not first reveal alone. Shuffle Snare cannot move cursed-pair tiles and only increments trigger counters when a real shuffle occurs.

## Verification
- `yarn vitest run src/shared/game.test.ts`
- `yarn typecheck:shared`
- `yarn test`
