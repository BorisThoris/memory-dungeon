# GLD-P1-005: Gauntlet Pause Deadline

## Status
Done

## Priority
P1

## Problem
Gauntlet deadlines used wall-clock time while normal pause UI copy promised timers freeze, so a paused gauntlet could expire before play resumed.

## Implemented Behavior
Paused gauntlet time extends the run deadline on resume. A paused gauntlet is not expired while paused, and the renderer expiry watch ignores paused runs.

## Verification
- `yarn vitest run src/shared/game.test.ts src/renderer/store/useAppStore.test.ts`
- `yarn typecheck:shared`
- `yarn test`
