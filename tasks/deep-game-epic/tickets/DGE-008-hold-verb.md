# DGE-008: Hold: stack matches, release one cascade

## Status
Not started

## Priority
P0

## Phase
1 · Act II

## Subsystem
Verb

## Depends on
- `DGE-002`
- `DGE-012`

## Current repo context
- Dock tools: `src/renderer/components/runShellToolCatalog.ts`, `runShellFreshTools.ts`, `board-power-actions.ts`, `board-power-availability.ts`, `board-power-state.ts`; the pop and chain: `pop-reach-simulation.ts`, `chain-rung-value-rules.ts`, `combo-heat-rules.ts`; `MISS_DECISION_HOLD_MS` for tools that act on a miss.
- Tetris Effect finding: one added verb that defers the payoff and releases it as one.

## Problem
The pop's share of a late board is half what it is at fourteen pairs. The late game needs its spectacle back, and the player needs something to be good at that they could not do on floor 1.

## Target experience
From Act II the dock has Hold. A meter fills one segment per chain link (six to arm). Pressing Hold keeps matched pairs on the board face-up and glowing instead of detonating. Release fires every held pair's cascade at once as one pop, the combo multiplier applied once to the whole stack. A miss while holding drops the stack to half. Hold is the planned mega-cascade: the chain clip's best footage.

## Implementation notes
- `src/shared/hold-rules.ts`: `holdMeter` on `RunState` (segments, armed), `heldPairs` on `BoardState`, `releaseHold(board, run, rng)` computing one cascade from all held pairs with `pop-reach-simulation.ts` reach rules and the matched cells as a single seed set.
- Hook: in the match seam, when `holding`, skip the pop and push the pair to `heldPairs`; the realm cast, lantern and anchor still fire on the match (they are information, not payout). On release, run the pop once, then the sticky-fingers mark.
- Dock tool `hold` in the catalog with armed, holding and release states; keyboard and controller bindings; touch; `e2e/tools-usable.spec.ts` presses it through the board's pick handler.
- Feedback: held pairs glow with `comboSoftCap`-bounded alpha; release pitch runs up through the stack; a `holdBeat.ts` for the words; the realm room's overdrive reads the release size.
- Counters: `holdsReleasedThisFloor`, `largestHoldThisRun`; achievements hook for the feat unlocks (DGE-024).
- Codex, `ENCYCLOPEDIA_VERSION`, interaction graph node with a `displays` edge to the HUD meter.

## Acceptance criteria
- A release of n held pairs yields exactly one cascade whose reach equals the union reach of the n pairs seeded together (unit test against the pop simulation).
- Pop share by act (DGE-012) is at or above 0.6 in Acts II to IV with Hold used by the average simulated player.
- A miss while holding halves the stack, never empties it; the floor's last pair can be held and released.
- The tool is usable by keyboard, controller and touch and the e2e tool test passes.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `hold-rules.test.ts`; hall rooms "Hold six and release", "A miss halves the hold", "Hold the last pair"; soak invariant: `heldPairs` is empty at every floor clear; `yarn sim:cascade` with the Hold player.

## Risks and edge cases
- Hold changes scoring and generation of the pop: `GAME_RULES_VERSION` bump.
- Holding delays the combo-driven surfaces; they must keep climbing on the meter instead of standing still (AGENTS.md §2).
- Headless WebGL runs at a few frames a second; e2e steps stretch `resolveDelayMultiplier` rather than wall-clock waits.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
