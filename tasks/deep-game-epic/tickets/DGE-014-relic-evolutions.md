# DGE-014: Six relic evolutions, blueprints as boss drops

## Status
Not started

## Priority
P0

## Phase
2 · Camp

## Subsystem
Camp

## Depends on
- `DGE-013`
- `DGE-026`

## Current repo context
- `run-relic-rules.ts`, `run-store-rules.ts`, `miss-bank.ts` (`missBankCap` reads relics), `lantern-light-rules.ts`, the relic inventory. Recipes in `../02-deep-game-plan.md` §4.

## Problem
Power must come from combinations, and the Warden needs a condition a planned build can meet.

## Target experience
A relic at rank 3 held beside its partner at rank 3 is offered its evolution once, at the next camp, for gold, if the run holds the blueprint. Six evolutions: Lantern of Recall, Miser's Vault, Cartographer's Thread, Keystone Heart, Unmasking Glass, Echo Chamber.

## Implementation notes
- `relic-evolution-rules.ts`: recipe table, `availableEvolutions(run)`, `applyEvolution`; evolutions occupy the slot of their first ingredient.
- Effects wired where each ingredient's effect lives (miss bank cap, lantern duration, wanderer trail length, hold refill, mask reveal, echo length). Effects whose mechanic is not built yet (Masks, Echo) ship inert and are enabled by their tickets.
- Blueprints: `RunState.blueprints`, dropped by bosses through DGE-026; shown in the inventory.
- Store stock rule: the evolution row appears once; declining it loses it for the run.

## Acceptance criteria
- An evolution is offered only with both ingredients at rank 3 and the blueprint; a soak counter shows evolutions occurring in average runs by floor 40.
- Each effect has a unit test on the real timer, bank or rule it changes.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `relic-evolution-rules.test.ts`; camp e2e; `run-soak.test.ts` requires the evolution counter; Codex entries.

## Risks and edge cases
- Seeded offers change: `GAME_RULES_VERSION` bump.
- Six new icons through the local art pipeline (DGE-030).

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
