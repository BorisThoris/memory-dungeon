# GLD-P1-009: Progress Registry Adapters

## Status
Done

## Priority
P1

## Problem
Daily archive, objective board, and quest campaign progress rows are separate read models with overlapping status/progress semantics.

## Implemented Behavior
The registries remain separate, but `local-progress-registry` normalizes them into a shared local-only adapter shape for parity checks and future UI handoff.

## Verification
- `yarn vitest run src/shared/daily-archive.test.ts src/shared/objective-board.test.ts src/shared/quest-campaign.test.ts src/shared/local-progress-registry.test.ts`
- `yarn typecheck:shared`
- `yarn test`
