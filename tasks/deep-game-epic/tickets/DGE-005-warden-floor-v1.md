# DGE-005: The Warden at floor 60, rule-only first version

## Status
Done (2026-10-20), rule-only first version. The difficulty target is unmeasured: see notes.

## Priority
P0

## Phase
0 · Spine

## Subsystem
Boss

## Depends on
- `DGE-002`
- `DGE-003`

## Current repo context
- `src/shared/boss-encounters.ts` (`BOSS_ENCOUNTER_IDENTITY`, `BOSS_FLOOR_SCORE_MULTIPLIER`, presentation slots), `miss-bank.ts` (`MISS_BANK_*`), `floor-par.ts`, `GameOverScreen.tsx`.
- Vampire Survivors finding: a designed end (the Reaper at 30 minutes).

## Problem
A competent run never ends on its own. There is no floor the player is pushing toward and no death that is a story.

## Target experience
Floor 60 is the Warden. Its rules, stated on the HUD before the floor: every turn past par takes one miss from the bank; every fifth turn the face-down cards are re-dealt (pinned cards and the current chain's last pair exempt). Clearing it ends the run as a win and unlocks Endless (DGE-006). Dying to it is the run's designed end. The full version with the Hold condition is DGE-023.

## Implementation notes
- `src/shared/warden-rules.ts`: `wardenTurnPenalty(run)` and `wardenRedeal(board, rng)`; hooked after the turn resolves and before the restless drift so the two never both move cards in one turn.
- Schedule entry at floor 60 with `floorArchetypeId: 'warden_hall'` and `encounterRole: 'boss'`; archetype copy in `FLOOR_ARCHETYPE_CATALOG`.
- Run outcome: `RunState.outcome = 'warden_cleared' | 'warden_fell' | ...`, read by the results screen (DGE-007) and the save (DGE-031).
- Par on the Warden floor is the normal par; the penalty is what makes it the end.

## Acceptance criteria
- `yarn sim:run` at 15% misses: at least half of average-player runs end at the Warden; a careful run can clear it.
- The re-deal never removes the last way to finish (board inspector invariant).
- The HUD states both rules before the first flip and the Codex carries them.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `warden-rules.test.ts`; a hall room "The Warden takes a miss past par" and one "The Warden re-deals on turn five"; soak invariant: a run past floor 60 has `outcome` set.

## Risks and edge cases
- Re-dealing is a board mutation like the restless drift; it must respect the same exemptions or the softlock inspector will catch it in soak.
- If the owner picks floor 48 instead of 60 (ledger decision), only `DESCENT_ACTS` changes.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
2026-10-20:
- `src/shared/warden-rules.ts`: `applyWardenTurn(before, after)` runs after `applyMissBudget` at both `resolveBoardTurn` sites (the Gambit and the two-card turn). It does three things:
  - A turn past par takes one miss, matched or not. When the bank is already empty it ends the run (`miss_budget`). The turn that clears the floor is the win and is not charged.
  - Every fifth turn it re-deals the face-down, unpinned cards among their own cells. The cards keep their ids, it uses `shuffleWithRng`, and the seed is `warden:seed:rules:level:turns`. Each re-deal is counted in `wardenRedealsThisFloor`.
  - It marks `wardenOutcome: 'fell'` on any run that ends on the Warden's floor.
- `finalizeLevel` marks `wardenOutcome: 'cleared'`. The store's level-complete continuation (`levelCompleteContinuationExecutor.ts`, beside the pass-and-play final floor) ends the run with `runEndReason: 'warden_cleared'`; the results stamp reads "THE WARDEN FALLS". `advanceToNextLevel` is untouched, so the sims, the soak and `sim:endless` still play past 60 (where the Abyss and the Warden repeat) until DGE-006 decides Endless.
- Floor 60 is the `warden_hall` archetype, the abyss act's boss entry with no mutators: the rules live on the hall, so no mutator moves a card in the same turn. Both rules hang in the board’s crown for the whole floor (`warden-rules` in `GameScreen`, seen in the test-pace playtest at floor 60; the caption that also states them, `wardenStudy`, is screen-reader only since 2026-09-30), its identity contract carries them into the next-floor preview, and the Codex has a Warden topic; the Descent topic no longer says the Abyss goes on (encyclopedia 95). `FLOOR_SCHEDULE_RULES_VERSION` 6, schedule-only, no `GAME_RULES_VERSION` bump.
- Graph node `hazard.warden`, not `boss.warden`: the `boss.` prefix belongs to the deleted dungeon layer and the graph test bans it. The Codex guard against the old layer's "wardens" now names the plural, since the Warden is back as one boss. Ledger entry, census exemption (the census and the soak never reach 60), mechanic count 72, two hall rooms (`warden-past-par`, `warden-redeal`), unit tests, and a soak miss invariant that counts the Warden's extra miss.
- **Acceptance not met, and why.** `yarn sim:survival` now reports Warden clears and falls. At 5, 8 and 10% misses, 19, 18 and 14 of 20 runs reach floor 60 and every one clears it (0 falls). At 15%, runs end around floor 20 and none reach it. Both sim players (survival and soak) are omniscient: they match any pair they choose except their deliberate misses, so they never pay to explore a 24-pair board and never go past par. The "half of average runs end at the Warden" target cannot be measured until a player with limited memory exists. The DGE-001 numbers also say the 15% player dies around floor 20, long before 60. The soak run 61 floors deep (40 careful seeds) passes every invariant through the Warden's floor and its re-deals.
- Next: a memory-model sim player before any Warden tuning (DGE-012 measures the pop and could carry it); DGE-006 for what clearing the Warden unlocks; DGE-007 for the results screen's win.
