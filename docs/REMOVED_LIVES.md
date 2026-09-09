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

**Combo shards themselves stayed that generation** - `MAX_COMBO_SHARDS = 2`, one every second
consecutive match, more from chunk breaks and shard sparks, `hud-combo-shards` on the HUD. With the
conversion gone they were a reading of momentum and nothing more; **Gen 184 removed them** (the
section below). The two removals were kept apart so each diff reads on its own.

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

## Gen 184: the shard

> Written from the rule modules as they stood on the Gen 183 tip (`ffb44795`), the last commit that
> carried a shard.

The combo shard was the life economy's bank. Every second consecutive match added one
(`COMBO_SHARD_STREAK_STEP = 2`, `turn-match-reward-rules.ts`); a chunk break added one per two pairs
it took, one per pair at Fever (`chunkBreakComboShards`, `chunk-break-rules.ts`); the **Shard Spark**
findable paid one on its match (`FINDABLE_MATCH_COMBO_SHARDS.shard_spark = 1`); an Extreme Fever finish
paid one at the floor clear (`MOMENTUM_BONUS_BY_TIER.fever.shards = 1`, `applyMomentumBonusShards`).
The bank held two (`MAX_COMBO_SHARDS = 2`, `combo-shard-rules.ts`), and until Gen 183 three of them
bought a life. After Gen 183 they bought nothing: a run reached the cap on its first chain and the
HUD's **Shards 2** never moved again. Thesis §44.4 - there is no consumable and no charge other than
the Recall - and §40 - every reward is score, so the one number the player watches is the one that
climbs - both say the same thing about a bank that fills and stays full.

### What went

- `SessionStats.comboShards`, `MAX_COMBO_SHARDS`, `combo-shard-rules.ts` and
  `turn-match-reward-rules.ts` (their only job was the shard), `chunkBreakComboShards` and the
  `comboShardGain` on the chunk-break result, `LevelResult.momentumBonusShards`,
  `applyMomentumBonusShards` and `MOMENTUM_BONUS_BY_TIER` (the momentum bonus keeps its tier and the
  Extreme Fever tag; since Gen 181 the tier multiplies the floor-end bonus, ×5 at Fever, and that is
  what Extreme Fever pays now).
- The **Shard Spark** findable: `FindableKind` is `'score_glint'` alone,
  `FINDABLE_KIND_SPAWN_WEIGHTS = { score_glint: 100 }`, `FINDABLE_MATCH_COMBO_SHARDS` is gone,
  `findableComboShardGain` is gone from the match-claim context. `GAME_RULES_VERSION` 39 → 40, since
  the spawn roll changes the deal.
- The core: effect `combo_shard.request`, event `combo_shard.requested`, definition
  `findable.shard_spark`, and `comboShardsBefore/After` on the announcement facts and the
  `board.turn_resolved` event. Removed types are not schema-bumped (`GAMEPLAY_CORE_SCHEMA_VERSION`
  stays 1); a journal naming them is dropped at load.
- The inventory item `combo_shard`, the run-economy row `combo_shards`, the cascade sim's
  `comboShardsGained`, the `sim-endless` / `sim-gameplay-core` shard fields.
- The HUD **Shards** stat (`hud-combo-shards`) and its polite live-region lines, the inventory
  screen's shard row and "Burst bank" loop signal, the shard SFX (`chain_reward_cashout`,
  `chain_reward_armed`, the lost-payoff accent on a miss), the `lost-reward` miss floater heat.
- **The chain reward forecast.** `getChainRewardForecastCues` in `chainMomentum.ts` told the player
  which streak step would bank the next shard; everything downstream of it - the board's "reward
  hot" tile marking and hot lane, the reward ladder pips, the "cashout armed" / "one-away cashout"
  / "combo prime" copy on the HUD, floater and toasts, the pickup toast's "Stack prime", the payoff
  chips `chainReward` and `next` and the `build` lane, the `Cashout` action on the focused-tile
  preview, the beat signal's cashout tier - forecast a shard and nothing else, and went with it.
- Codex: the `sys_combo_shards` entry and the `combo_shards` glossary term; the chain entry's
  "drop combo shards" and "a shard and two gold at Fever" lines now describe the floor-end bonus
  multiplier. `ENCYCLOPEDIA_VERSION` 32 → 33.
- Interaction graph: `findable.shard_spark` and `inventory.combo_shard` and their edges; version
  33 → 34 (47 → 45 mechanics, 137 → 131 edges).

### What the Codex said

> **Combo shards** - Each **even-numbered** consecutive match adds a **combo shard**; chunk breaks
> and shard sparks on the board add to the same bank. The bank is small and resets with the run:
> shards are a reading of momentum, not something to spend.

> **Combo shards** (glossary) - Streak resource: every second consecutive match adds one, chunk
> breaks and shard sparks add more; the bank is small and resets with the run. Avoid: gems, paid
> shards.

### What stays

The Score Glint (+25 on its match, spilled by a break), the momentum bonus tier and the Extreme
Fever tag, the floor-end bonus and its tier multiplier, the chain meter, the pickup counter. The
trait-interaction lane ids `'shard'` and `'guard'` (`traitInteractionLaneMap.ts`) and the
readability tier `reward-hot` with its `traitRewardHotTileIds` telemetry input are presentation
channels no rule feeds any more; they are a follow-on cleanup, not part of this removal.

### Measured

`sim:occupancy --ratchet` matches its baseline: findable claims 1.000 of floors × 1.54 a floor before
and after, since the Score Glint now takes the whole spawn roll. `sim:cascade --check` and
`sim:endless --check` hold every band. The numbers are in `BALANCE_NOTES.md` under Gen 184.

## How to get any of it back

Everything here is in git; the removal commits carry `Gen 183` and `Gen 184` in their messages, and each section
names the module a rule lived in, so `git log --all -S<symbol> -- src/shared/<module>.ts` finds its
whole history. The intent is not that a life economy returns. If a run ever needs to end sooner than
the ceiling, the thesis's answer is to move the ceiling (§42.2), measured against the cascade
bands, not to put the hearts back.
