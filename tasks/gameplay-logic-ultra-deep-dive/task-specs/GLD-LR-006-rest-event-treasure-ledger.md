# GLD-LR-006 Rest Event Treasure Ledger

## Status
Done

## Problem
Rest, event, and treasure hooks needed local source/sink visibility in long-run economy checks.

## Implemented Behavior
Long-run soak includes economy ledger summaries built from balance simulation live inflow rows.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts src/shared/economy-ledger.test.ts`

