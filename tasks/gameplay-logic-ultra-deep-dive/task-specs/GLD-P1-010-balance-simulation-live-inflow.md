# GLD-P1-010: Balance Simulation Live Inflow

## Status
Done

## Priority
P1

## Problem
Balance simulation covered schedule and board smoke signals but underrepresented live economy inflow from route, event, room, key, shop, and power-charge sources.

## Implemented Behavior
Simulation now reports deterministic local estimates for live economy inflow using existing shared rules. Runtime gameplay is unchanged.

## Verification
- `yarn vitest run src/shared/balance-simulation.test.ts src/shared/exploit-surface.test.ts`
- `yarn sim:endless --floors=1000 --seed=42001`
- `yarn typecheck:shared`
- `yarn test`
