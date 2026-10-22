# DGE-025: The Depths: twenty rungs after the Warden

## Status
Done (2026-10-22): twenty rungs

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

2026-10-22, twenty rungs (no rules change).
- `depth-rules.ts` (a leaf): the table of twenty, `runDepth`, `depthHas`, `depthRung`. Each rung is one existing constant a step harder, asked at its own site with `depthHas(run, id)`: 1 a quarter less study, 2 no misses sold, 3 the bank opens with two, 4 no calm door before an act boss, 5 the bank holds one fewer, 6 the store a quarter dearer, 7 Wanderers from floor 7, 8 the Keeper every third turn, 9 the Cartographer every second match, 10 the Warden every fourth turn, 11 masks from 13, 12 Sleepers from 25, 13 the Hold at seven, 14 a carve at three, 15 no opening shuffle, 16 three Sleepers, 17 three masks, 18 it learns you from 25, 19 three Wanderers, 20 the Warden complete behind every door. The deck's "restless from floor one" and "peaks every second weather" were left out: both would be new rules, not a constant moved.
- **No `GAME_RULES_VERSION` bump**: Depth 0 is the game as it was, bit for bit (`createNewRun` without a depth equals Depth 0, tested), and every rung is false there, so no baseline reseeds.
- Gate: `recordDescent` opens Depth n + 1 when the Warden falls at Depth n (`bestDepth`, schema 10 from DGE-031). Run setup shows the Depth picker once one is open; the share key carries `:d<n>`; pass-and-play is always Depth 0.
- HUD: the board crown names the Depth and its rung's rule (`depth-rule`); the boss crowns read the wound clocks. Results: "Floor 41 · The Abyss · Depth 7" and "Depth 8 opened" among the firsts. Profile: "Depth n open" on the descent cell's source line. Codex `sys_depths` lists all twenty (ENCYCLOPEDIA 115).
- Checks: a unit test per rung against the constant it names; `yarn soak --floors=62 --depths` plays seed i at Depth i mod 21 (210 seeds x 4 players, every Depth 263-376 floors per player, 0 violations) and reports each Depth apart with how many reached the Warden; `sim:survival --depth n` measures Warden reach at a Depth: at 15% misses 55 of 100 runs reach the Warden at Depth 0 (unchanged, the gate), 40 at Depths 5, 10 and 15, and at Depth 20 none fell it, because the sim player never holds - a Hold of twelve is the deed that rung asks for. The one-in-twelve target needs a player model that holds; the survival sim is not one.
- Graph `progression.depths` with its `displays` edge, ledger, census exemption (chosen before the run; the census plays Depth 0), hall exemption (chosen before any board).
- Not done: `difficulty-profile.ts` rows stay placeholders (the Depths did not need them); pre-filled progress (DGE-004) is not wired to the Depth picker.
