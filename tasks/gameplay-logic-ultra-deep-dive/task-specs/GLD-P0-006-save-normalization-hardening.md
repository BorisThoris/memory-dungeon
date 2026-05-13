# GLD-P0-006: Harden Save Normalization And Read Failure Handling

## Status
Done

## Priority
P0

## Source Passes
Pass 10, Pass 19.

## Problem
`normalizeSaveData` trusts many corrupted values, and hydration failure silently starts a default profile. A later successful save can overwrite recoverable user data.

## Proposed Behavior
- Clamp and validate numeric stats, booleans, unlock IDs, achievement map values, puzzle completion maps, and last-run summary shape.
- Track save-read failure state in the store/UI.
- Avoid writing over existing storage after failed hydration until the user confirms recovery or a backup path is established.

## Acceptance Criteria
- Corrupted save inputs normalize to safe defaults without unlocking gates or poisoning profile/history.
- Read failure is visible to the player.
- Failed read does not silently become destructive overwrite.

## Verification
- Save fuzz tests for NaN/Infinity/negative stats, invalid achievements, bad unlocks, malformed summary, bad puzzle completions.
- Store hydration failure test.

## Implementation Notes
- Save normalization now clamps malformed numeric/settings/progression fields and validates achievements, unlocks, puzzle records, relic counts, and run summaries.
- Hydration read failure is visible and blocks autosave over recoverable corrupted storage.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Existing save fuzz coverage is partial; missing cases include non-finite values, malformed unlocks, arbitrary achievement values, and malformed puzzle records.
- Confirmed read failure can fall back to defaults without a visible blocker.
- Acceptance must validate known IDs and shapes for achievements, unlocks, puzzle completions, and `RunSummary`.
