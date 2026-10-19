# REG-020: Mutator Chapter Identity

## Status
Done. Superseded in part (2026-10-19) by the [Deep Game Epic](../deep-game-epic/README.md) for chapter identity as acts with their own verb, family, board and boss: [DGE-002](../deep-game-epic/tickets/DGE-002-descent-act-schedule.md) and [the plan](../deep-game-epic/02-deep-game-plan.md).

## Priority
P1

## Area
Gameplay

## Evidence
- `src/shared/mutators.ts`
- `src/shared/game.ts`
- `src/shared/run-mode-catalog.ts`
- `src/renderer/components/GameScreen.tsx`
- `docs/gameplay-tasks/GP_AUDIT_ROLLUP.md`

## Problem
Mutators are mechanically present but need stronger floor or chapter telegraphing. They can affect rules without feeling like a distinct chapter identity that the player anticipates and adapts to.

## Target Experience
Each floor band or chapter should have a readable identity. Mutators should be announced, explained, and reflected in board behavior, rewards, visuals, and risk profile.

## Suggested Implementation
- Group `MutatorId` entries into chapter themes or floor bands.
- Add pre-floor telegraphing and in-run reminder UI for active mutators.
- Give chapters subtle visual, audio, or board presentation differences.
- Ensure mutator state is represented in `RunState` and deterministic for seeded modes.
- Bump `GAME_RULES_VERSION` when mutator behavior or assignment rules change.

## Acceptance Criteria
- Active mutators are visible before and during affected floors.
- Mutator descriptions explain the player action impact, not just internal rules.
- Chapters feel distinct across at least three floor bands or mode phases.
- Daily and seeded runs reproduce the same mutator sequence.

## Verification
- Unit test mutator assignment and seeded determinism.
- Manual play through floors with multiple mutator combinations.
- Capture pre-floor, active HUD, and Codex explanations.

## Cross-links
- `REG-017-between-floor-route-choice.md`
- `REG-004-gameplay-hud-density-hierarchy.md`
- `REG-031-performance-graphics-real-device-pass.md`
