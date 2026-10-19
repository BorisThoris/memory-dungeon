# DGE-025: The Depths: twenty rungs after the Warden

## Status
Not started

## Priority
P1

## Phase
5 · Meta

## Subsystem
Meta

## Depends on
- `DGE-023`
- `DGE-031`

## Current repo context
- Contracts in `src/shared` (`noShuffle`, `maxMismatches`), Scholar and Ascetic runs, `difficulty-profile.ts` (one shipped profile, `future_placeholder` rows), `profile-deepest-floor.ts`.
- Slay the Spire finding: the post-win ladder.

## Problem
The ladder in the pitch needs its gate and its rules.

## Target experience
Beating the Warden opens Depth 1. Each Depth adds exactly one named rule to the run (examples in the deck: shorter study, camp prices up a rank, no calm door after floor six, bank cap three, restless from floor one, peaks every second weather, no misses sold). Clearing the Warden at Depth n opens n+1. Twenty at launch.

## Implementation notes
- `depth-rules.ts`: rung table as contract-like modifiers applied at run creation; `difficulty-profile.ts` rows become real.
- Run setup UI: a Depth picker up to the highest unlocked; HUD shows the Depth and its rule; results and Profile show the best Depth.
- Pre-filled progress on opening (DGE-004).

## Acceptance criteria
- Each rung is one rule and it is named on the HUD.
- The soak plays every rung at least twice; `sim:run` records the Depth at which each simulated player dies, for the one-in-twelve target.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit per rung; soak; e2e run setup.

## Risks and edge cases
- Rungs that change generation reseed baselines: group them into one `GAME_RULES_VERSION` bump.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
