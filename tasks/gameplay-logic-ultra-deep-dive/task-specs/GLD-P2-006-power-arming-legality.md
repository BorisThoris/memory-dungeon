# GLD-P2-006 Power Arming Legality

## Status
Done

## Problem
Destroy and Peek could appear available when the next target path could not execute.

## Implemented Behavior
Power verb rows now expose disabled reasons for open flips, `noDestroy`, missing charges, and missing valid targets.

## Verification
- `yarn vitest run src/shared/p2-contracts.test.ts src/shared/power-verbs.test.ts`

