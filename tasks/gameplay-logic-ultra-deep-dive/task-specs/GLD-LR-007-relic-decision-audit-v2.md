# GLD-LR-007 Relic Decision Audit V2

## Status
Done

## Problem
Relic archetype rows needed a direct long-run changed-decision and UI-surface handoff.

## Implemented Behavior
Long-run relic decision rows extend the relic audit with changed decision copy, UI surface, and regression key for every relic.

## Verification
- `yarn vitest run src/shared/long-run-depth.test.ts src/shared/relics.test.ts`

