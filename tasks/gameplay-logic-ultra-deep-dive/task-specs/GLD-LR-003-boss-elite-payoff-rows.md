# GLD-LR-003 Boss Elite Payoff Rows

## Status
Done

## Problem
Boss and elite payoff rows existed separately from long-run cadence checks.

## Implemented Behavior
The long-run model consumes boss/elite encounter identity rows for scheduled boss floors and route elites.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts src/shared/boss-encounters.test.ts`

