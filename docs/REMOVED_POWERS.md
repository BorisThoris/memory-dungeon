# Removed: Destroy pair, and Remove stray tile

Gen 200. Rules version 47 → 48. Encyclopedia version 39 → 40.

Two board powers left the game in one pass. They are recorded together because they left for the
same reason, arrived at from opposite ends: one could never be pressed, and one could only ever be
pressed against the player's own interest.

This is the record. It exists so that nobody re-derives either mechanic from first principles in
six months, finds the wiring still half-present in an old branch, and wonders why it went.

## Destroy pair

**What it was.** Arm Destroy, tap a hidden tile, and both halves of that pair were removed from the
board as matched — no score, no pickup, no chain. It was the answer to a floor you could not
finish: a pair you had lost track of, or one a mutator had made expensive. It had a dock button, a
glyph, a red corner accent on every eligible card, an aria hint, a heavy break sound with a sampled
OGG behind it, an armed-state HUD beat, a `noDestroy` contract flag, an achievement path, and a
mutator interaction (`score_parasite` reset its pressure counter on a destroy).

**Why it went.** It could not be pressed. `destroyPairCharges` is created at `0` in
`run-creation-rules.ts`, and every other reference in the codebase either decrements it or reads
it to decide whether the button is enabled. Nothing grants one — no floor curio, no run setup, no
mutator, no achievement, no contract, no debug path a player can reach. The Gen 199 census recorded
it as UNREACHABLE rather than merely unseen, which is a different and worse thing: an exemption
that says "the census cannot reach this" is a note about the census, but one that says "nothing in
the game can reach this" is a note about the game.

Faced with the choice — grant the charge, or remove the power — this pass removed it. A power whose
whole job is to skip a pair you cannot solve is a bad fit for what the game became: floors clear by
popping contact chains now, the boards are small, and the softlock-fairness guarantee already
promises every floor is completable. Destroy was an escape hatch for a game with hazards, exits and
blockers in it, and all of those left in Gen 173–196.

## Remove stray tile

**What it was.** Arm Stray, tap a hidden singleton — a card with no partner anywhere on the board —
and it was removed from play. It cost `strayRemoveCharges`, locked Perfect Memory, and could never
target a card with a partner, so it could not orphan anything. A chaos run setup granted one charge
at run start, and the sticky_toffee floor curio granted one mid-run, so unlike Destroy it was
genuinely reachable.

**Why it went.** After Gen 196 removed the glass decoy — following the exit key, the lever and the
shop door before it — the wild joker became the only singleton left in the game. So Stray's only
legal target was the wild joker, and the wild joker is the card that lets you complete a pair whose
partner you cannot find. Every legal press of Stray deleted the player's own wild match. The power
had become a button whose sole function was to throw away a better button.

Its original job — clearing an orphan singleton that was blocking board completion — left with the
cards that could block completion. Nothing in the current game creates an unmatched card that has
to be cleared; every card is half of a pair, plus at most one wild joker that helps.

## What went with them

- `destroyPairCharges`, `strayRemoveCharges`, `destroyUsedThisFloor` on `RunState`, and the
  `noDestroy` contract flag.
- `applyDestroyPair`, `applyStrayRemove`, their availability and targeting rules, their gameplay
  commands (`board.destroy_pair`, `board.stray_remove`), their events, and their feedback cues.
- The two dock tools, their glyphs (`GameplayDestroyIcon`, `GameplayStrayIcon`), their armed HUD
  beats, their board back-accents (`'destroy'`, `'stray'`) and the aria hints that described them.
- Two sampled sound effects and their manifest rows: `destroy-pair`, `stray-power`.
- `RUN_TOOL_REASONS.stray` and the encyclopedia entries for both powers.
- Four graph mechanics and nineteen edges — 45 mechanics / 131 edges down to 41 / 112.

## What changed because they left

- **The sticky_toffee curio** used to hand over a stray charge. It now grants a shuffle instead.
  The greeting's shape is unchanged: you address the toffee, the toffee does not answer, and the
  floor comes unstuck.
- **The chaos run setup** used to grant `initialStrayRemoveCharges: 1` alongside the wild joker. It
  now grants the wild joker alone, which is what a chaos run was actually for.
- **The wild joker's occupancy re-banded from `common` to `core`.** Stray was the only thing that
  ever took the joker off the board before it could be spent; with Stray gone, a run that holds the
  token spends it on every floor — 1.000 of setup-pass floors, measured, not assumed.
- **The graph's counterplay edge floor dropped from 14 to 11.** Both powers were the named answer
  to other mechanics, so removing them removed the edges that pointed at them. Re-baselined against
  the graph rather than propped up: an answer nobody can give is not counterplay.
- **The census reads 30 of 41 rather than 30 of 45**, and the two UNREACHABLE exemption lines are
  gone. The ratio improved by deleting the debt, not by covering it.

## Save compatibility

Both charge fields are dropped from `RunState`. Old saves carrying them are read through the same
normalization every removed field goes through: unknown keys are ignored, and a run resumed from
one simply has two fewer numbers. No migration writes them back, and nothing reads them.

## If someone wants a power like this again

Do not restore either one from this history. Both were shaped by a game with hazard cards, dungeon
rooms and blocked floors, and none of that is here. If a future floor needs an escape hatch, the
question to answer first is what it is escaping from — because right now, nothing.
