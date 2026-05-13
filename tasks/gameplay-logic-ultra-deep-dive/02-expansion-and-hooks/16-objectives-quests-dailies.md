# Pass 16: Objectives, Quests, Dailies

## Design Map
- Contracts include no-shuffle, no-destroy, max-mismatch, max-pin, bonus relic pick.
- Featured objectives rotate through the schedule and reward score/Favor/streak/wager outcomes.
- Objective board and quest campaign both exist, but Profile uses only the objective board.
- Daily archive stores aggregate count, last key, and cosmetic streak.

## Weak Spots
- Daily fairness drift: meta relic draft extra is marked disabled in Daily but appears to apply.
- Daily completion runs on game over, not necessarily a clear.
- Archive is not historical: no per-date attempt records or weekly bests.
- Quest campaign is data-only in current UI.
- Objective board has duplicate sources.
- Challenge gates are informational, not authoritative.
- `objective-rules.ts` is only a re-export shell.
- Contracts are prohibition-heavy and lack fantasy around max mismatches.

## Task Candidates
- Fix Daily meta fairness contract.
- Define daily completion semantics and enforce in save merge/copy.
- Add Daily archive v2 with per-date records.
- Unify objective registry across board, quest, gates, Profile, Collection, Game Over.
- Surface quest ladder and active quest contract rows.
- Add named max-mismatch vow/preset.

## Verification
- Daily archive/save/meta progression tests.
- Objective board, quest campaign, challenge progression, and mode gating tests.

## Refinement Notes
- `Confirmed`: Daily meta fairness drift exists: meta says disabled in Daily while daily start still copies the option into run creation.
- `Confirmed`: daily completion merges on game over and can feed seven-daily achievement eligibility.
- `Confirmed`: daily archive is aggregate/derived, not historical per-date storage.
- `Confirmed`: objective board, objective items, and quest campaign are overlapping registries with different status behavior.
- `Likely`: challenge gates are mostly informational because mode availability drives action enablement.
- Acceptance should cover failed zero-clear daily, Daily meta exclusion/copy truth, registry parity, daily archive v2 policy, and a named max-mismatch fantasy.
