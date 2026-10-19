# REG-018: Endless Mode Shipping Plan

## Status
Done. Superseded in part (2026-10-19) by the [Deep Game Epic](../deep-game-epic/README.md) for Endless as an unlocked mode with its own scaling: [DGE-006](../deep-game-epic/tickets/DGE-006-endless-gated-mode.md), and the Depths ladder in [DGE-025](../deep-game-epic/tickets/DGE-025-depths-ladder.md).

## Priority
P1

## Area
Gameplay

## Evidence
- `src/shared/run-mode-catalog.ts`
- `src/shared/game.ts`
- `src/renderer/components/ChooseYourPathScreen.tsx`
- `test-results/visual-screens/mobile/portrait/01a-choose-your-path.png`
- `docs/gameplay-tasks/GP_AUDIT_ROLLUP.md`

## Problem
Endless is visible but locked, and naming between Classic and endless progression can be confusing. A visible locked mode is useful only if the player understands whether it is coming soon, unlockable, or unavailable in the current build.

## Target Experience
Endless should either be shippable with clear rules or clearly staged as locked/upcoming. Classic and Endless should have distinct promises, scoring rules, and completion expectations.

## Suggested Implementation
- Decide whether Endless ships in the next release or becomes an explicit upcoming mode.
- Define Endless-specific `RunModeDefinition` fields for scoring, floor scaling, fail conditions, and rewards.
- Add `RunState` support for endless progression if current floor/end conditions are insufficient.
- Update labels, lock messaging, and mode descriptions to avoid Classic/endless ambiguity.
- Bump `GAME_RULES_VERSION` when Endless scoring or deterministic rules are finalized.

## Acceptance Criteria
- Choose Path explains Endless availability and requirements.
- If playable, Endless has complete start, progression, game-over, and post-run summary flows.
- If locked, the lock state is intentional and not mistaken for broken functionality.
- Classic mode naming remains clear.

## Verification
- Start Classic and Endless or verify locked Endless copy and disabled state.
- Capture Choose Path and game-over summaries for the mode state.
- Add shared logic tests for Endless floor scaling if implemented.

## Cross-links
- `REG-010-choose-path-discoverability.md`
- `REG-023-daily-weekly-results-loop.md`
- `REG-030-telemetry-and-balance-playtest-loop.md`
