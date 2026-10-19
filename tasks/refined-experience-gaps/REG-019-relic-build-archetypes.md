# REG-019: Relic Build Archetypes

## Status
Done. Superseded in part (2026-10-19) by the [Deep Game Epic](../deep-game-epic/README.md) for relic slots and evolutions: [DGE-013](../deep-game-epic/tickets/DGE-013-relic-slot-cap.md) and [DGE-014](../deep-game-epic/tickets/DGE-014-relic-evolutions.md).

## Priority
P1

## Area
Gameplay

## Evidence
- `src/shared/relics.ts`
- `src/shared/game.ts`
- `src/renderer/components/FloorClearOverlay.tsx`
- `src/renderer/components/CodexScreen.tsx`
- `docs/gameplay-tasks/GP_AUDIT_ROLLUP.md`

## Problem
Relics exist, but build identities and archetype synergies need to be stronger. Individual relic choices can be useful without making the player feel they are building toward a recognizable strategy.

## Target Experience
Relic picks should suggest archetypes such as combo scaling, safe reveal, risk burst, suit/rank mastery, economy, or control. A player should be able to name their build by mid-run.

## Suggested Implementation
- Tag each `RelicId` with one or more archetypes and synergy hooks.
- Add relic offer rules that avoid random noise and support emerging builds.
- Surface synergy hints in relic choice UI and Codex entries.
- Keep effect logic centralized against `RunState`.
- Bump `GAME_RULES_VERSION` when relic effects, offer weights, or scoring impact changes.

## Acceptance Criteria
- Relic catalog has clear archetype tags or equivalent grouping.
- At least three build paths have multiple supporting relics.
- Relic choice UI communicates why an offered relic fits the current run.
- Codex or collection screens explain archetype relationships.

## Verification
- Unit test changed relic effects and offer weighting.
- Manual playtest several runs and record build diversity.
- Capture relic choice and Codex views on mobile and desktop.

## Cross-links
- `REG-008-overlays-mobile-height-and-hierarchy.md`
- `REG-015-shop-and-run-currency-system.md`
- `REG-030-telemetry-and-balance-playtest-loop.md`
