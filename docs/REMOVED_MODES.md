# The four extra modes, archived

> Read out of the catalogs themselves by a generator, on the commit before they were deleted, and
> then frozen. Nothing here is remembered or paraphrased: every row below is the definition the game
> shipped. The generator is not kept — it read live catalogs that no longer hold these entries, so
> re-running it could only fail. This file is the record now; edit it only to correct it.

## Why they were removed

Five modes meant five loops to balance and one loop to get right. Every measurement this repository takes -
the occupancy census, the cascade bands, the pop ladder - is taken against `endless`, because that is the mode
the simulations run and the mode a player reaches by pressing Play. The other four were tuned by inheritance:
they took whatever `endless` was worth that week and added a rule on top.

The cost was not their content, it was their **branches**. A mode is a conditional in every system it touches,
and four extra modes put a `run.gameMode === ...` check inside the turn path, the relic offer, the recall
bonus, the music, the timer, the score and the save. Each one is a place the loop under test and the loop a
player plays can quietly diverge. Collapsing to one mode deletes those divergences outright: what the
simulation measures is now what everyone plays.

See `docs/THESIS_THE_ADDICTIVE_LOOP.md` Part V for what the one mode is, and Appendix C.7 for the terms on
which a daily could return - as a **seed**, not as a mode.

## The modes, as the Codex described them

### Daily Challenge `daily`

Everyone plays the **same seed** for the **UTC calendar day**. Daily mutators come from a **fixed rotation table** keyed off the date so the challenge is shared worldwide.

### Puzzle `puzzle`

Fixed handcrafted boards from the built-in puzzle set; puzzle JSON menu import is not enabled in this build.

### Gauntlet `gauntlet`

A **run-wide wall-clock deadline** from the menu duration preset (commonly **5 / 10 / 15** minutes). When time runs out you hit **game over** even with lives left—pace your clears against the clock.

The card went in Gen 171, but the clock did not: it lived on as the setup sheet's **Pressure** option
(`timed_5`, `timed_10`, `timed_15`) and a run could still be ended by the wall clock with lives left.
The thesis says no timer, ever (§43.4), so Gen 178 removed the clock end to end — the run and timer
fields, the expire command, the pause extension, the HUD Clock stat, the countdown music layer and
cue, the timed-run identity and the share-key variant. The last run summary had recorded the clock's
length, so that was a save shape change (schema 8, one-way, the field dropped on load).

### Meditation `meditation`

Longer memorize windows and calmer pacing for practice-style runs.

## Achievements that went with them

| Id | Title | What it asked for |
| --- | --- | --- |
| `ACH_SEVEN_DAILIES` | Week of Archives | Complete seven Daily runs (UTC calendar days, cumulative). |
| `ACH_GAUNTLET_RUN` | Gauntlet Runner | Clear three floors in a single Gauntlet run. |
| `ACH_PUZZLE_SOLVER` | Puzzle Solver | Complete every built-in Puzzle layout. |
| `ACH_MEDITATION_HOUR` | Long Sitting | Clear eight floors in a single Meditation run. |

Each was unearnable the moment its mode went, which is exactly the failure the reachability gate
(`achievement-reachability.test.ts`) exists to catch. They are removed rather than left standing.

## Honors that went with them

| Id | Title | What it asked for |
| --- | --- | --- |
| `honor_daily_initiate` | Daily Initiate | Complete at least one Daily run (UTC day). |
| `honor_daily_streak_3` | Triple Dawn | Reach a cosmetic daily streak of three UTC days. One missed day is forgiven. |
| `honor_daily_streak_7` | Week of Days | Reach a cosmetic daily streak of seven UTC days. One missed day is forgiven. |
| `honor_gauntlet_proof` | Gauntlet Proof | Finish a Gauntlet run with at least one floor cleared (last run summary). |

## The daily meta layer

The daily mode carried a meta layer of its own, and all of it is removed with the mode:

- `playerStats.dailiesCompleted` - cumulative UTC-day clears.
- `playerStats.lastDailyDateKeyUtc` - the last day counted, so a second clear on one day did not count twice.
- `playerStats.dailyStreakCosmetic` - consecutive UTC days with a clear.
- `playerStats.dailyStreakGraceAvailable` - the streak's one forgiven miss (Gen 78/79).
- `playerStats.puzzleCompletions` - per-puzzle local records.
- The daily archive share strings, the streak share, and the Profile share button that used them.

The one thing these gated that a player could actually spend was the **Week of Archives** permanent upgrade
(`relicShrineExtraPickUnlocked`, +1 relic selection at every milestone shrine). Rather than delete a real
reward, it is re-sourced onto a counter the one mode can move: **seven cleared floors whose chain reached
Sharp** (`playerStats.sharpFloors`). Same reward, same cost, reachable by playing the game that remains.

Saves that carry the removed fields still load: the migration drops them, and no other field changes.

## Modules deleted

- `src/shared/builtin-puzzles.ts`
- `src/shared/puzzle-import.ts`
- `src/shared/daily-archive.ts`
- `src/shared/daily-determinism.test.ts`
- `src/shared/run-timer-rules.ts`

Their tests go with them. Mode branches inside surviving modules were removed in place; `git log` for the
commit that added this file has the full diff.

