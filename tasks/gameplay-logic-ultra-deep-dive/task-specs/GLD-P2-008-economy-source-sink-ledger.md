# GLD-P2-008 Economy Source Sink Ledger

## Status
Done

## Problem
Economy source/sink breadth existed across systems but lacked a shared local ledger view.

## Implemented Behavior
`economy-ledger` provides local-only source/sink rows and summary totals, with balance simulation inflow mapped into ledger rows.

## Verification
- `yarn vitest run src/shared/economy-ledger.test.ts src/shared/balance-simulation.test.ts`

