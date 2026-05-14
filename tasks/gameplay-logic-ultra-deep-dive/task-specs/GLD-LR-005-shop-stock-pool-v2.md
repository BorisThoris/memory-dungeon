# GLD-LR-005 Shop Stock Pool V2

## Status
Done

## Problem
Shop stock was deterministic but source differences were not explicit enough for long-run economy tuning.

## Implemented Behavior
Long-run shop stock pool rows split floor-clear, board, route, rest, event, and treasure hooks with distinct deterministic item sets.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts`

