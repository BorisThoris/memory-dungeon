# DGE-024: Thirty sideways feat unlocks

## Status
First ten done (2026-10-22); twenty to come with their mechanics

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

2026-10-22, the first ten (no rules change), as the owner chose: ten feats on existing options.
- `feat-unlocks.ts`: the table (id, name, condition, title, option, unlock text, `earned(run)`), read off the run as it plays and recorded beside the achievements (`runResolutionController.ts`, never from a shared table or a test-pace run) as `feat:<id>`, `cosmetic:<title>`, `option:<id>`, all accepted by the save's tag list (round-trip tested).
- The ten: Twelve Held (a released Hold of twelve - a new `largestHeldReleaseThisRun`, since `largestHoldThisRun` counts the pairs popped), Warden-Feller, Alchemist, Mason, Encore, Ring-Walker, Night Watch, Hallbreaker, Map-Burner, Unmasker.
- Unlocks: a title each (ten new `title_*` cosmetics, `gameplayAffecting: false`); Alchemist also opens the **Evolve** camp preference (the camp ranks the relics the run's blueprints ask for first), shown in the run setup only once unlocked and carried by the share key. A test holds every unlock to a title or a title and an option.
- Collection: a Feats section, every feat's condition and unlock shown earned or not (no progress bars); looked at in the isolated browser. Codex `sys_feats` (ENCYCLOPEDIA 114).
- Every feat has a hall room that performs it, built from the room that already plays the deed (started one short where the feat counts), so a feat and its mechanic cannot drift apart.
- Not done: Steam achievements for them (DGE-028); the other twenty, with their mechanics' variants.
