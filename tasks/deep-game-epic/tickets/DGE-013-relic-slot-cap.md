# DGE-013: Four relic slots and the replacement choice

## Status
Done (2026-10-21), rules 76. The ceiling is met but not passed until DGE-014 adds a fourth ranked relic: see notes.

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

2026-10-21, built (rules 76):
- `RELIC_SLOTS` 4, `relicSlotsFull`, `heldRelicIds`, `giveUpRelic` (`run-relic-rules.ts`). The store blocks a relic not held as `slots` on a full set; ranks of a held relic are still sold.
- The camp spends gold automatically (there is no store screen to choose in), so the choice the ticket describes is the Miser's Purse: taken on a full set it names the relic it replaces, its ranks going with it. The take-relic gameplay command carries `replaceRelicId` (journals replay it); `GameScreen` asks with an `OverlayModal` (`relic-replace`), "Keep them all" backs out. Not reversible until Descend: the Purse is taken mid-floor, not at a stop, and backing out of the choice is the undo.
- Inventory: "Relics: n of 4 slots".
- **Today the ceiling is never passed**: the camp sells three ranked relics (the Tallow Candle is not sold under camp rules) and a Curio holds the Purse, four in all. It becomes live when DGE-014 makes the Candle a fourth ranked upgrade, which its recipes need.
- Codex: the camp topic states the four slots, and the stale lines found on the way were fixed - the camp's "no route choice is needed" (doors return before act bosses, rules 75) and the miss bank's flat grant and cap (rules 73). ENCYCLOPEDIA_VERSION 103.
- Soak: the invariant that a run never holds more relics than its slots; a full set's Purse gives up the lowest-ranked relic. 5 x 200: 0 violations.
