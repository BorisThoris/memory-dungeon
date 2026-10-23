# DGE-008: Hold: stack matches, release one cascade

## Status
Done (2026-10-20), as specified; the feedback pass done 2026-10-23. The pop-share acceptance is unmet by design: see notes.

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
2026-10-20, before any code: a probe (BALANCE_NOTES, "The Hold probe") played the perfect player with a Hold. The release was one `resolveChunkBreak` per suit over the held seeds.
- Held at every chance, the pop share fell as the stack grew.
- With the ticket's six-link meter it ties the no-Hold baseline at best, even with release bursts of up to three extra pairs per held pair.
- The acceptance "pop share by act >= 0.6 in Acts II to IV with Hold used" cannot be met by deferring pops: every pair matched by hand while holding is one the release can no longer take.
Shown this, the owner chose (2026-10-20) to build the Hold as this ticket specifies. Its pop-share acceptance is recorded as unmet rather than tuned around. A pop that scales with the board was offered as the fix for the share itself.
Design notes kept for the build:
- Held pairs are `matched` with only the pop deferred, as seed ids on the run, so the board inspector and the flip-state tools are untouched.
- Release breaks once per suit, so seeds of different suits do not walk into each other.
- No `GAME_RULES_VERSION` bump: it is a new input, and a run that never presses it replays as before.

2026-10-20, built: `src/shared/hold-rules.ts` with the seams in `board-turn-transition.ts` (`applyHoldTurn` before the Warden's), `turn-match-board-resolution-rules.ts` (no pop spec while holding) and `next-floor-run-state-rules.ts` (the hold resets per floor).
- The dock tool `hold`: Hold with the meter as its badge, Release with the pairs held. An empty meter shows it without a badge, since the dock hides a tool at zero charges.
- A release strips odd cards it broke (a Turncoat's promise goes, an Hourglass with sand is caught) and reconciles the realm's holds as any break does; both were soak violations before.
- The Zone and the Hold exclude each other: the Zone replays turns a hold cannot keep seeds through.
- Checklist rows ticked: rules module, hall rooms (`hold-release`, `hold-miss-halves`, `hold-last-pair`), soak invariants and counters, graph node `power.hold` with its `displays` edge, ledger entry, census exemption, Codex `sys_hold` (encyclopedia 98), a look in the browser.
- Not yet: the held-pair glow, the release pitch run, `holdBeat.ts` words, a controller binding and the `tools-usable` e2e press. Acceptance "pop share >= 0.6" is recorded as unmet (see above).

2026-10-23, the feedback pass:
- Glow: `HoldSeeds.tsx` (DGE-030) - each cell a held pair left keeps a gold seed that breathes brighter with every pair held, never past full, still under reduced motion.
- Pitch run: the release cue (`playDeepGameSfx`, DGE-030) runs bells up the cascade's own scale, one per doubling held.
- Words: `holdBeat.ts` says the Hold starting, a miss dropping part of the stack, and the release ("Released 4 held pairs: every one breaks at once."), each once, through the polite live region; unit-tested.
- Controller: the dock's roving toolbar gives the pad every tool, the Hold among them (`gamepadNavigation.ts`); no tool has a keyboard shortcut of its own, so none was added.
- `e2e/tools-usable.spec.ts`: Hold pressed, a pair matched and held, Release pressed and the stack broken; passes in the isolated station with Carve and Reprise.
- Not done: the realm room's overdrive reading the release size (the room reads the combo, which the release already raises).
