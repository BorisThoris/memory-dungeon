# DGE-013: Four relic slots and the replacement choice

## Status
Not started

## Priority
P1

## Phase
2 · Camp

## Subsystem
Camp

## Depends on
- `DGE-002`

## Current repo context
- `run-relic-rules.ts`, `run-store-rules.ts`, `camp-upgrades.test.ts`, `store-stock.test.ts`, `docs/CAMP_ECONOMY.md`, the camp screen and `InventoryScreen.tsx`.
- Vampire Survivors finding: a build ceiling forces planned growth.

## Problem
The camp has no ceiling, so more relics add power without a decision.

## Target experience
A run holds four relics. Buying a fifth asks which to replace, and the replaced relic's ranks are gone. The camp shows the four slots at all times.

## Implementation notes
- `RELIC_SLOTS = 4` in `run-relic-rules.ts`; `purchaseRelic` returns a `needsReplacement` state the camp renders as a choice; `CAMP_ECONOMY.md` updated.
- Inventory shows slots, empty ones included.

## Acceptance criteria
- Never five relics on a run (soak invariant).
- Replacing is reversible until Descend (the camp is a stop; the choice is confirmed on leaving).
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `run-relic-rules.test.ts`; camp e2e through the store sheet; soak.

## Risks and edge cases
- The ledger decision three-or-four changes one constant.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
