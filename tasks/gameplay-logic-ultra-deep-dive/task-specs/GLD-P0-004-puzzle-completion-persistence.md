# GLD-P0-004: Persist Puzzle Completion

## Status
Done

## Priority
P0

## Source Passes
Pass 09, Pass 10.

## Problem
`playerStats.puzzleCompletions` is read by puzzle library/gates, but no runtime path appears to write it after clearing a puzzle.

## Proposed Behavior
- Define terminal puzzle outcome: clearing an authored puzzle records completion and routes to results/library, not procedural continuation unless explicitly designed.
- Add a save merge helper for puzzle completion with score, mistakes, rating/medal, and completion count if supported by current schema.
- Ensure puzzle clear persists before navigation away.

## Acceptance Criteria
- Clearing a built-in puzzle updates `playerStats.puzzleCompletions[puzzleId]`.
- Reloading shows the puzzle completion state.
- Puzzle mode does not silently continue into procedural floors unless a documented “next puzzle” flow exists.

## Verification
- Store/game tests for clearing starter puzzle.
- E2E: clear starter puzzle, reload, verify shelf medal/progress.

## Implementation Notes
- Puzzle clears persist `playerStats.puzzleCompletions[puzzleId]` on `levelComplete`.
- Repeat clears keep the best score and lowest mistake count supported by the current save shape.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed save/read models consume `playerStats.puzzleCompletions`.
- No write path was found in store completion handling.
- Acceptance must define puzzle result shape, repeat-clear best behavior, and terminal navigation after clear.
