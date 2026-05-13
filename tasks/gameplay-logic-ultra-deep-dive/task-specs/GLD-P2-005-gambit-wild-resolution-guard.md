# GLD-P2-005 Gambit Wild Resolution Guard

## Status
Done

## Problem
Gambit resolution could spend wild capacity when the wild was merely the unmatched third tile.

## Implemented Behavior
Wild capacity is spent only when the selected matched pair includes the wild tile.

## Verification
- `yarn vitest run src/shared/p2-contracts.test.ts`

