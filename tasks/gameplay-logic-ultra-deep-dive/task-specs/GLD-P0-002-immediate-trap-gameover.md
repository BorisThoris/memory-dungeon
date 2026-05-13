# GLD-P0-002: Handle Immediate Trap-Reveal Game Over In Store

## Status
Done

## Priority
P0

## Source Passes
Pass 03, Pass 18, Pass 20.

## Problem
`flipTile` can return `gameOver` during immediate hidden trap reveal, but the normal store flip path only sets `run`. It may skip the game-over summary, achievement, save, audio, and notification side effects handled by `applyResolvedRun`.

## Proposed Behavior
When any tile press path receives a `RunState` with `status === 'gameOver'`, route it through the same game-over handling used by resolved turns and enemy contact.

## UI / Copy
Show the immediate trap cause in the visible event/cause surface and game-over summary.

## Acceptance Criteria
- Fatal trap reveal produces normal game-over persistence and summary.
- No duplicate game-over side effects fire.
- SFX/notifications follow the same policy as other fatal outcomes.

## Verification
- Store test: one-life run, press fatal hidden trap, assert summary/save/achievement path.
- Unit test for trap reveal status transition if needed.

## Implementation Notes
- Fatal tile-press paths now route immediate `gameOver` states through normal terminal handling.
- Armed UI modes and exit prompts are cleared after immediate terminal handling.
- Verified with `yarn typecheck:shared`, focused Vitest coverage, and full `yarn test`.

## Refinement Evidence
- Confirmed that `flipTile` can return `gameOver` before normal store resolution handling.
- Confirmed `applyResolvedRun` owns terminal summary/save/achievement side effects.
- Acceptance must include daily/no-powers policy, armed-mode cleanup, and no duplicate terminal handling.
