# GLD-LR-008 Fatigue Guardrails

## Status
Done

## Problem
Long-run pressure, reward inflation, breather spacing, and relic cadence needed explicit guardrails.

## Implemented Behavior
Long-run fatigue rows cover hazard pressure, contact pressure, breather spacing, relic offer spacing, and reward inflation.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts src/shared/balance-simulation.test.ts`

