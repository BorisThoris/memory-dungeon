# GLD-LR-001 Act Boss Cadence

## Status
Done

## Problem
Long-run act, boss tag, generated boss identity, and boss objective could drift.

## Implemented Behavior
Boss-tagged floors now keep generated boss identity and `defeat_boss` objective coherent in the long-run read model.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts src/shared/game.test.ts`

