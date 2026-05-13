# GLD-P0-001: Make Stray Remove Completion-Safe

## Status
Done

## Priority
P0

## Source Passes
Pass 02, Pass 04, Pass 11, Pass 20.

## Problem
`applyStrayRemove` can remove one tile from a normal pair, leaving its partner orphaned. That orphan is not matchable and not destroy-eligible, so the run can become incompleteable.

## Proposed Behavior
Choose one completion-safe contract and apply it consistently:

- Preferred: Stray can target only true singleton/special-safe tiles and must reject normal real-pair tiles.
- Alternative: Stray removes/resolves the whole pair and clearly forfeits rewards.
- Do not allow one real-pair tile to be removed unless another guaranteed completion route exists.

## UI / Copy
Target preview must explain why a normal pair is blocked or what reward is forfeited. Update `STRAY_TILE.md`, Codex/mechanics copy, and power verb copy.

## Acceptance Criteria
- Stray cannot create `real_pair_missing_actionable_tile`.
- Stray target preview matches runtime legality.
- Fairness inspection remains green after legal stray use.

## Verification
- Unit tests for normal pair, final pair, wild run, route anchors, decoys, and singleton utility targets.
- `src/shared/softlock-fairness.test.ts` regression for post-stray state.

## Implementation Notes
- Stray now targets only completion-safe hidden singleton/special tiles and blocks normal real-pair tiles.
- Preview and runtime legality share the same completion-safe target contract.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed against Stray preview/runtime paths and current fairness tests.
- This is a rules contract change because current tests encode normal pair targeting as allowed.
- Add post-action `inspectRunFairness` coverage after legal Stray use.
