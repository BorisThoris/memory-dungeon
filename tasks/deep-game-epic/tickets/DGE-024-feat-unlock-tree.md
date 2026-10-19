# DGE-024: Thirty sideways feat unlocks

## Status
Not started

## Priority
P1

## Phase
5 · Meta

## Subsystem
Meta

## Depends on
- `DGE-008`
- `DGE-009`
- `DGE-031`

## Current repo context
- `achievements.ts` (seventeen, Partner API names), `honorUnlocks.ts` (`honor:*` tags in `saveData.unlocks`), `CollectionScreen.tsx`, `CodexScreen.tsx`, `tasks/refined-experience-gaps/REG-016`.
- Balatro finding: unlocks as guided tours into under-used mechanics; Bycer: never a required stat.

## Problem
Unlocks should teach the deep game, and none may be a stat.

## Target experience
Thirty feats, each in an under-used mechanic, each unlocking content for that mechanic: a variant family, a blueprint path, a boss rule set, an Endless option, a cosmetic. Examples in `../02-deep-game-plan.md` §6.

## Implementation notes
- `feat-unlocks.ts`: feat table (id, predicate over run counters, unlock id, Codex text); evaluated in `applyResolvedRun` beside achievements.
- Unlock ids in `saveData.unlocks` (DGE-031); gating points read `hasUnlock`.
- Collection shows locked feats with their condition (no hidden progress bars).

## Acceptance criteria
- No unlock changes a number the deep game requires (a test lists every unlock's effect kind: family, verb variant, rule set, cosmetic, mode).
- Every feat has a hall room that performs it and a Codex entry.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- `feat-unlocks.test.ts`; save round-trip; hall rooms; Collection render test.

## Risks and edge cases
- Thirty hall rooms is real work; ship ten with the ticket and the rest with their mechanics.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.
