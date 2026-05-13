# GLD-P1-008: First-Run Onboarding Targets

## Status
Done

## Priority
P1

## Problem
Playable onboarding target selection could choose special pairs because it only filtered matched, decoy, and wild tiles.

## Implemented Behavior
Playable onboarding now targets only ordinary real pairs. It skips decoys, wilds, exits, shops, rooms, route cards, dungeon cards, hazards, findables, cursed/spotlight pairs, and other special utility tiles.

## Verification
- `yarn vitest run src/shared/playable-onboarding.test.ts src/renderer/components/PlayableOnboardingHarness.test.tsx src/renderer/store/useAppStore.test.ts`
- `yarn typecheck:shared`
- `yarn test`
