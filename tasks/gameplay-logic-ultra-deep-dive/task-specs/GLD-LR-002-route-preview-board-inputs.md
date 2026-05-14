# GLD-LR-002 Route Preview Board Inputs

## Status
Done

## Problem
Route preview copy did not expose the actual next-board identity inputs.

## Implemented Behavior
Long-run route preview rows include node kind, floor tag, archetype, objective, reward, risk band, and actual board input key.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts src/shared/run-map.test.ts`

