# GLD-P1-001: Clarify Replay And Export Contract

## Status
Done

## Priority
P1

## Source Passes
Pass 05, Pass 09, Pass 10.

## Problem
Docs describe import/export/replay APIs that are absent. Current replay key is only `mode:rulesVersion:seed`, which cannot reconstruct many modes or player choices.

## Proposed Behavior
Rename current feature to a local share-key/seed recipe and remove player-facing replay/import claims. True replay remains unimplemented until a structured descriptor includes mode entry, seed, rules version, schedule version, daily date, flags/contracts, mutators, gauntlet duration, rules-affecting settings, route choices, puzzle data policy, and flip timeline policy.

## Acceptance Criteria
- UI/docs do not claim replay unless replay is reconstructable.
- Structured descriptors round-trip every supported mode if implemented.

## Verification
- `yarn vitest run src/shared/run-history.test.ts`
- `yarn typecheck:shared`
- `yarn test`

## Implementation Notes
- `src/shared/run-history.ts` now exposes `buildRunShareKey` and labels the current value as a local share key, not a replay link.
- Game-over and social/share copy now describe share keys and journal rows without promising importable replay.
- Puzzle boards are explicitly unsupported for share-key reconstruction because they require tile payload data.
- `buildRunReplayLink` remains as a compatibility alias for older internal imports, but the active contract is share-key terminology.

## Refinement Evidence
- Confirmed current replay link is `mode:rulesVersion:seed` and explicitly lacks flip timeline reconstruction.
- Confirmed docs reference absent `run-export` APIs.
- Descriptor policy must name required fields: schedule version, daily date, contract flags, mutator timeline, route choices, gauntlet duration, puzzle ID/payload policy, and whether flip timeline is included.
