# GLD-P1-006: Destroy Charge Policy

## Status
Done

## Priority
P1

## Problem
Destroy-charge sources and copy disagreed about whether the run bank was capped.

## Implemented Behavior
Destroy charges remain an uncapped run-local bank. Reward sources that add destroy charges add directly to that bank. `noDestroy` blocks spending/use without deleting existing banked charges.

## Verification
- `yarn vitest run src/shared/game.test.ts src/shared/run-events.test.ts`
- `yarn typecheck:shared`
- `yarn test`
