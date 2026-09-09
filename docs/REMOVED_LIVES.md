# The life economy, archived

> Written from the rule modules as they stood on the last commit before Gen 183 removed them
> (`5ec16f0d`, the Gen 182 tip). Nothing here is remembered or paraphrased: every constant and every
> Codex line below is the one the game shipped. This file is the record now; edit it only to correct it.

## Why it was removed

The thesis is direct about it. §42.2: **there are no lives.** A run ends in two ways only - the player
stops, or a floor is not cleared within its turn ceiling. §23.5(b): the failure state of a memory game
is "I forgot", and that lands as a personal deficiency in a way "I mistimed" never does; making it
painful is the fastest way to turn a pleasant challenge into an unpleasant one. §67, trace 4: a bad
floor - seven misses on fourteen pairs - has to be *unremarkable*, not punishing. The chain resets,
the floor pays less, the next one starts, and no screen says you did badly.

Lives were the opposite of all three. A miss took one; at zero the run was over. Everything else in
this file exists because that rule was too harsh on its own and was patched rather than removed:
the first miss on a floor was forgiven, a token could absorb the next, a long chain healed one back,
three shards bought one, a clean clear paid one. Six systems, five of them there to soften the sixth,
and the player still had a row of hearts telling them how close they were to the end. The pressure
signal the thesis wants (§43) sits on the par - turns against par, and now against the ceiling -
where it says *how well*, not *how much longer*.

**The run does not end because you forgot.** It ends when you stop, or when you could not finish a
board at all - three times par means missing two-thirds of your flips, which is a floor under
competence and not a difficulty gate.

## What replaced it

- **The turn ceiling.** `TURN_CEILING_PAR_MULTIPLIER = 3` and `turnCeilingForFloor(pairs) =
  parTurnsForFloor(pairs) × 3` in `src/shared/floor-par.ts`, with `turnCeilingForRun` and
  `turnsToCeiling` for the HUD. After any resolved turn - match or miss - that leaves the floor open
  with `turnsThisFloor >= turnCeilingForFloor(board.pairCount)`, `applyTurnCeiling` (applied at the
  end of `resolveBoardTurn`, `board-turn-transition.ts`) ends the run: `status: 'gameOver'`,
  `runEndReason: 'turn_ceiling'`. A floor that clears on its ceiling turn is a clear, not an end.
- **A recorded reason.** `RunEndReason = 'turn_ceiling' | 'quit' | 'contract' |
  'pass_and_play_final_floor'`; `RunState.runEndReason` is `null` while the run is alive and
  `RunSummary.runEndReason` persists it (a save-field-policy row: absent reads as unknown, no
  migration). A contract's `maxMismatches` still ends the run, as `'contract'`.
- **The par stat carries the ceiling.** The HUD par (`hud-par`) reads `4 of 5 turns, ceiling 15` and
  sets `data-ceiling-near="true"` once two turns or fewer remain; the pause overlay's "Lives" row is a
  "Turns" row. The game-over screen says how the run ended in one line under the score.
- **A miss costs the chain and nothing else.** It still counts a try (rating) and a turn (par). The
  trace-4 test, `src/shared/bad-floor-is-quiet.test.ts`, pins it: a fourteen-pair floor with seven
  misses ends `levelComplete`, the score went up, and the mismatch copy for that floor contains none
  of *life, lives, lost, penalty, punish*.
- Versions: `GAME_RULES_VERSION` 38 → 39, `SAVE_FIELD_POLICY_VERSION` `save-183-v8`,
  `ENCYCLOPEDIA_VERSION` 31 → 32. `GAMEPLAY_CORE_SCHEMA_VERSION` stays at 1, as it did when the exit
  commands went in Gen 173: a journal entry naming a removed command fails its schema and is dropped,
  nothing is migrated forward.

## The systems, as they shipped

### Lives

`RunState.lives`, `INITIAL_LIVES = 4`, `MAX_LIVES = 5`. A run started with four and could hold five.

- **Lost** on a mismatch (`calculateMismatchPenalty`, `turn-mismatch-rules.ts`) unless the miss was
  the floor's first-mismatch grace or a guard token absorbed it. At zero, `status: 'gameOver'`. A
  contract's `maxMismatches` failing set lives to zero on the same path.
- **Restored**, capped at five: every eighth consecutive match (chain heal), three combo shards, and a
  clean or perfect clear - each below.
- **A lost life banked study time.** `addPendingMemorizeBonusForLostLives` added to
  `pendingMemorizeBonusMs` (160ms a life, capped at 500ms), applied to the next floor's memorize
  window. The field goes with its only source; floor residents lend and take memorize time on the
  floor's own timer, and never used it.
- **On the screen:** the HUD hearts (`hud-lives`), the pause overlay's "Lives" row, the life-lost and
  life-restored polite announcements, the "protect remaining lives" feedback lines, the life-lost cue,
  `chainContext.lives` on the tile board, the inventory's lives row, and the settings screen's
  reference-only "Max lives" control (options 2-5, never persisted).
- **Arrived** with the first Electron build (`f0df064a`, 2026-03-28: `lives: MAX_LIVES`); the
  four-to-start, five-cap shape the next day (`41cdafa8`).

### Guard tokens

`stats.guardTokens`, `MAX_GUARD_TOKENS = 2`, `COMBO_GUARD_STREAK_STEP = 4`
(`calculateResolvedMatchSurvivalReward`, `turn-match-reward-rules.ts`).

- **Earned:** one on every fourth step of the chain, capped at two.
- **Spent:** on a mismatch after the floor's grace was used, in place of a life; or to scare off the
  magpie (`resolveMagpieVisit` kind `'scared_off'`, counted in `magpieScaredOffThisFloor`) - the
  token was spent before the pick was made, so holding one was worth something on a magpie floor
  (the magpie and its scare both came in Gen 112).
- **Lent:** the off-duty guard resident (Gen 114) handed one over on arrival - "Not paid enough to
  fight anything. Will absolutely lend you a token and look the other way." / "One guard token, no
  questions." It lends a peek charge now, with new lines.
- **On the screen:** `hud-guards`, the inventory's guards row.
- **Arrived** in `d7a609cb` (2026-03-31), together with chain heal.

The magpie can no longer be scared off: the `'scared_off'` kind and `magpieScaredOffThisFloor` go.
Its Codex entry loses its last sentence ("A **guard token** scares it off, if you are holding one
when it arrives.").

### First-mismatch grace

`hasFirstMismatchGrace(run, board)` in `mismatch-grace-rules.ts`:

```
stats.tries === 0 && (board.level === 1 || (stats.guardTokens === 0 && run.lives >= 2))
```

The first miss on a floor cost no life - on floor one always, later only while you held no token
and had at least two lives. It decided nothing else: a grace miss still counted a try and a turn.
The module is deleted; with no life to spare, there is nothing for it to decide. Arrived in the
forgiveness pass, `e620b45c` (2026-04-03), as `tries === 0`; the floor, token and life conditions
were tightened later.

### Chain heal and shards to a life

- **Chain heal:** `CHAIN_HEAL_STREAK_STEP = 8` - every eighth consecutive match restored one life,
  capped at five. Arrived in `d7a609cb`.
- **Shards to a life:** `applyComboShardGain` (`combo-shard-rules.ts`), `COMBO_SHARDS_PER_LIFE = 3`,
  `lifeGain`. Below the cap, reaching three shards converted them into one life and kept the
  remainder in the bank. Arrived in the forgiveness pass, `e620b45c`.

**Combo shards themselves stay this generation** - `MAX_COMBO_SHARDS = 2`, one every second
consecutive match, more from chunk breaks and shard sparks, `hud-combo-shards` on the HUD. With the
conversion gone they are a reading of momentum and nothing more, and **Gen 184 removes them**; the two
removals are kept apart so each diff reads on its own.

### The clean and perfect clear life

`ClearLifeReason = 'perfect' | 'clean' | 'none'`; `getClearLifeReason(tries)` in
`level-clear-rules.ts` returned `'perfect'` at zero tries and `'clean'` at one. Either paid
`clearLifeGained: 1` when below the cap; `LevelResult` carried `clearLifeGained`, `clearLifeReason`
and `livesRemaining`, and `FLOOR_STATUS_COPY` had a line for the bonus. Arrived in the forgiveness
pass, `e620b45c`. The floor-clear beat now says the floor, its turns against par and what it paid;
there is no life to report.

### The score parasite

Mutator `score_parasite`; `RunState.parasiteFloors`; `advanceScoreParasiteFloor`
(`score-parasite-rules.ts`); command `floor.parasite_advance`; event `score_parasite.advanced`; a
HUD announcement. Each floor advance under the mutator counted one; at four the counter reset and
one life went, and nothing absorbed the hit. It had no other effect. Arrived in `f7564077`
(2026-04-04); its cycle floor, `parasite_tithe` at floor 11, in `0ee878bd` (2026-04-21).

Floor 11 of the cycle keeps the `parasite_tithe` archetype id - renaming it ripples through the
interaction graph and the reachability tests - but carries `distraction_channel` now, the one
mutator with no cycle floor of its own, and its title and copy are rewritten around it.

Codex entry, verbatim:

> **Score parasite** - While active, each **floor advance** counts toward parasite pressure; every
> **fourth** advance costs **one life**. Nothing absorbs the hit, so pace long runs accordingly.

### `ACH_LAST_LIFE`

Was **One Heart Wonder** - "Finish a level with exactly one life remaining."
(`lastLevelResult.livesRemaining === 1`), from the first Electron build (`f0df064a`). The id is a
Steam API name and cannot change, so the achievement is re-defined rather than removed: **Last Turn
Standing** - "Clear a floor on the final turn before its ceiling." (`turnsTaken === turnCeiling`).

## Codex copy that went, verbatim

Glossary terms:

> **Lives** - Run-wide health. Lives carry between floors; mismatches can remove them after
> grace/guard protection. *(avoid: hearts as currency, energy)*
>
> **Guard tokens** - Mismatch protection earned from long match streaks; capped and run-scoped.
> *(avoid: shield currency, premium shield)*
>
> **Combo shards** (old definition) - Streak resource: every second consecutive match adds one, and
> three convert into a life when you are below the cap.

Topics:

> **Lives and clears** - Mismatches cost lives. Lives carry across the run instead of resetting each
> floor; clears advance the floor.
>
> **Combo shards → extra life** - Each **even-numbered** consecutive match adds a **combo shard**
> (bank capped low). At **three** shards, if you are below max lives, shards convert to **+1 life**
> (remainder stays in the bank). Shard sparks on the board add shards to the same bank.
>
> **Chain heal & combo guard tokens** - Long **match streaks** can **restore a life** (every 8th
> consecutive match) and earn **guard tokens** (every 4th consecutive match, capped). The **first
> mismatch of a floor** is free (no life); after that, a **guard token** can absorb a mismatch instead
> of losing a life when available.
>
> **Bonus life on level clear** - Clearing a floor with **zero tries** can grant **+1 life** when you
> are below the life cap (**perfect** clear path). A **single** mismatch clear may still grant a
> smaller **clean** life bonus—see the results summary for that floor.

The Codex gains one entry in their place, **The turn ceiling**, under the core topics.

## Elsewhere

- The difficulty profile summary loses its `lives` and `forgiveness` blocks; the settings screen its
  "Max lives" reference control; the premium-economy policy the word "lives" from its never-monetize
  list and "buy lives" from its copy audit (continues stay); the release checklist's shared-game row
  reads "rather than until the ceiling ends it".
- Interaction graph nodes removed with their edges: `inventory.guard_token`,
  `safety.guard_absorption`, `progression.shard_to_life`, `hazard.score_parasite`.
- `sim:cascade`'s `fell` now means the ceiling ended the run; the reference player's ceiling share is
  a band (`referenceCeilingShare`). `sim:occupancy` loses its life, guard and scare rows and is
  re-baselined. The numbers are in `BALANCE_NOTES.md` under Gen 183.

## Modules deleted

- `src/shared/mismatch-grace-rules.ts`
- `src/shared/score-parasite-rules.ts`

Their tests go with them. Life, guard, heal, shard-to-life and clear-life branches inside surviving
modules were removed in place.

## How to get any of it back

Everything here is in git; the removal commit carries `Gen 183` in its message, and each section
names the module a rule lived in, so `git log --all -S<symbol> -- src/shared/<module>.ts` finds its
whole history. The intent is not that a life economy returns. If a run ever needs to end sooner than
the ceiling, the thesis's answer is to move the ceiling (§42.2), measured against the cascade
bands, not to put the hearts back.
