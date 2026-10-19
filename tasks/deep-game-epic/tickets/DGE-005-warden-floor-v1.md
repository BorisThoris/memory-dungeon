# DGE-005: The Warden at floor 60, rule-only first version

## Status
Not started

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
Leave next steps, checklist rows ticked, and known blockers here after implementation.
