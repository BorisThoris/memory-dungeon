# DGE-022: The dungeon learns you, and says so

## Status
Not started

## Priority
P1

## Phase
4 · Act IV

## Subsystem
Spine

## Depends on
- `DGE-003`
- `DGE-009`

## Current repo context
- Run counters on `RunState` (suit match tallies in the session stats, trait tallies), `floor-curio-greeting-rules.ts` as the model for a per-floor announced rule, thesis §25.13 (no hidden difficulty adjustment).

## Problem
Act IV should feel personal without being a hidden difficulty adjustment.

## Target experience
From floor 41 each floor states one rule chosen from the player's own run stats, before play: "the suit you match most hides from you this floor" (that suit's backs are masked), "your first flip each turn is a Wanderer", "the chain you broke most often is the one Sleepers watch". Always announced, never silent, never a stat change.

## Implementation notes
- `learned-rule-rules.ts`: a small table of rules keyed to a stat, `pickLearnedRule(run, rng)`; each rule is implemented by setting an existing mechanic's parameters (masks on a suit, wanderer selection, sleeper selection), never a new hidden rule.
- HUD: the rule in the curio greeting slot; Codex explains the table in full.

## Acceptance criteria
- Every learned rule is one of a documented table and is shown before the first flip.
- No rule reads performance to make the floor easier or harder by stealth; the same stats produce the same rule on the same seed.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Unit; hall room per rule; soak; Codex test.

## Risks and edge cases
- The line between "told adaptation" and "difficulty tuned against the player" is the Codex text; write it first.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
