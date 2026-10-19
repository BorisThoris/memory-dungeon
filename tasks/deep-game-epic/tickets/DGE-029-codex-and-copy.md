# DGE-029: Codex entries, encyclopedia version and copy locality

## Status
Not started

## Priority
P1

## Phase
Cross-cutting

## Subsystem
HUD

## Depends on
- `DGE-002`

## Current repo context
- `mechanics-encyclopedia.ts` (`ENCYCLOPEDIA_VERSION = 91`), `codexScreenModel.ts`, `src/renderer/copy/`, `scripts/copy-locality.ts` (54 hardcoded strings, gated baseline), `docs/mechanics` appendix builder.
- Thesis §25.15: no cognitive-benefit claims anywhere in copy.

## Problem
Thirteen mechanics, four acts, eight tiers, six evolutions, thirty feats and twenty rungs all need words a player reads, and the Codex is the place the rules are settled.

## Target experience
Every new player-facing rule has a Codex entry in the game's voice (plain, present tense, one idea per sentence), the appendix regenerates, and no new string is hardcoded in a component.

## Implementation notes
- One Codex entry per mechanic ticket, written before the mechanic (the rule text the hall room tests against).
- `ENCYCLOPEDIA_VERSION` bumps per shipped change; `yarn docs:mechanics-appendix` and the appendix snapshot refreshed.
- Copy drafts may come from the `local-llm` MCP as data; validate and edit.

## Acceptance criteria
- `yarn audit:copy-locality` does not grow; `audit:health-claims` passes.
- Every act, tier, evolution, feat and rung is in the Codex.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `mechanics-encyclopedia.test.ts`; appendix builder snapshot.

## Risks and edge cases
- Copy written after the mechanic drifts from the rule; write it first.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
