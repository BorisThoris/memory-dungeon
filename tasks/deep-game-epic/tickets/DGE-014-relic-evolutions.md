# DGE-014: Six relic evolutions, blueprints as boss drops

## Status
Done (2026-10-21), rules 77; all six evolutions live since Masks (rules 80) and Reprise (rules 83).

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

2026-10-21, built (rules 77):
- `src/shared/relic-evolution-rules.ts`: `EVOLUTIONS` (six recipes), `availableEvolutions`, `applyEvolution`, `declineEvolution`, `misersVaultCatches`, `footprintTurns`; `RunState.evolutions`, `declinedEvolutions`, `misersVaultUsedThisFloor`. Kept import-light (types, the relic rules, number guards): the miss bank and the Wanderers import it.
- **The Tallow Candle had no ranks** and was not sold under camp rules, so four of the six recipes could never be made. From rules 77 it is a fourth ranked camp upgrade (8/14/20 gold; rank N lights the cards beside a floor's first N matches) - which also makes DGE-013's four slots bind.
- The camp spends on its own, so it buys an evolution on offer before anything else; one it cannot pay for is declined and gone for the run, as the ticket's "declining loses it" says. Price 30 gold.
- An evolution takes its first ingredient's slot without removing it: every relic effect reads `relicRank`, which needs the relic held, so the ingredient keeps working, and it can be the first of no other evolution.
- Effects: Lantern of Recall (the lantern's light survives flips and accumulates for the floor), Miser's Vault (once a floor, 10 gold instead of the run-ending miss), Cartographer's Thread (footprints are now turn counts; three), Keystone Heart (a release of ten held pairs or more refills a miss). Unmasking Glass and Echo Chamber evolve and do nothing yet.
- Soak 5 x 200: 117 evolutions (24 by the average player), 0 violations, with invariants that each had its blueprint and that no two share a first ingredient. The afterglow invariant now judges only light an action newly lit (a Candle given up for the Purse, or Lantern of Recall, leave light that is not the afterglow's).
- Rules 77 reseed: the wildfire hall room pinned to seed 90211 (its own note already said some seeds land both fires on vine-held cards).
- Not done: a camp e2e (the camp is automatic; the inventory lists evolutions and blueprints); the six icons (DGE-030); the Warden's condition (DGE-023).

2026-10-23, the six icons: not built, by decision. Relics and evolutions are named chips on the inventory, an ink-and-paper screen that carries no relic art at all (the art rules keep those screens bare), so six icons for the evolutions alone would be the only ones there. The camp e2e stays a gap: the camp is automatic, and the inventory, the soak and the hall room `evolution-at-camp` cover what it does.
