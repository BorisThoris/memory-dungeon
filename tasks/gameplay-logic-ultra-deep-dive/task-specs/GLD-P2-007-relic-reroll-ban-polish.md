# GLD-P2-007 Relic Reroll Ban Polish

## Status
Done

## Problem
Reroll after ban could shrink below the target option count even when eligible relics remained.

## Implemented Behavior
Relic service reroll and ban refills now preserve the target offer count when enough eligible non-banned relics exist, and banned IDs persist within the visit.

## Verification
- `yarn vitest run src/shared/relics.test.ts`

