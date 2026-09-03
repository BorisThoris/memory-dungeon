# Relic roster (B1)

Relics are **run modifiers** stored on `RunState.relicIds` and chosen from `relicOffer` options (`src/shared/relics.ts`). They must not duplicate **forgiveness** jobs (grace first miss, guards, shards, streak softening, memorize bonus on life loss — see `GAME_FORGIVENESS_DEEP_DIVE.md`).

## Roster (`RelicId`)

| ID | Effect | Non-overlap note |
|----|--------|------------------|
| `extra_shuffle_charge` | +1 shuffle charge at pick | Forgiveness does not grant shuffle charges. |
| `first_shuffle_free_per_floor` | One free shuffle per floor (relic flag consumed in `applyShuffle`) | Distinct from unlimited forgiveness. |
| `memorize_bonus_ms` | Extra memorize time (applied via memorize helpers) | Forgiveness only banks bonus after **life lost**; this is baseline comfort. |
| `destroy_bank_plus_one` | +1 destroy charge at pick | Destroy remains a **power** with tradeoffs; forgiveness does not fill destroy bank. |
| `combo_shard_plus_step` | Head start on combo shards | Shards still follow chain rules; this only accelerates earning. |
| `memorize_under_short_memorize` | Extra memorize time while **Short memorize** mutator is active | Synergy with `short_memorize`; distinct from `memorize_bonus_ms` baseline. |
| `parasite_ward_once` | Ignore the next **score parasite** life loss once | Interacts with `score_parasite` advance drain; not a generic extra life. |
| `region_shuffle_free_first` | First **row shuffle or tile swap** each floor costs no charge | Pairs with Search-position powers; distinct from `first_shuffle_free_per_floor` (full-board shuffle). |
| `peek_charge_plus_one` | +1 peek charge | Information assist; does not change mismatch rules. |
| `stray_charge_plus_one` | +1 stray-remover charge | Board edit power; still counts as a power where relevant. |
| `pin_cap_plus_one` | +1 concurrent pin capacity (`maxPinnedTilesForRun`) | Distinct from contract max-pin challenges. |
| `guard_token_plus_one` | +1 guard token (capped at `MAX_GUARD_TOKENS`) | Same token economy as streak/guard gains. |
| `shrine_echo` | Banks **+1 relic selection** for the **next** milestone draft (`grantBonusRelicPickNextOffer`) | Does not grant picks on the floor you take it; stacks with other draft bonuses. |
| `chapter_compass` | Scheduled Endless drafts lean harder into current/next chapter answers | Draft-shaping relic; does not add a fourth card. |
| `wager_surety` | Won risk wagers grant +1 extra Favor; lost wagers keep objective streak at x1 | Wager-specific risk control, not a generic life or score boost. |
| `parasite_ledger` | Successful scheduled Endless parasite objectives reduce parasite pressure by 1 | Slows score-parasite pacing without removing the mutator. |

## Standing-rule roster

Everything above pays out once, at the moment it is taken, so a draft changes the numbers a run starts a floor with. These six pay on a condition the board keeps offering instead, so holding one changes which tiles a player goes for. Each is a `relic.active` content definition applied from the live trait path (`STANDING_RULE_RELIC_DEFINITIONS` in `gameplay-core-contracts.ts`, call sites in `tile-trait-rules.ts`); the matching `relic.<id>` claim definition deliberately pays nothing and only states the rule.

| ID | Fires when | Effect | Non-overlap note |
|----|-----------|--------|------------------|
| `opening_ledger` | first match resolved on any floor | +25 score | Rewards opening confidently; forgiveness never pays for a match. |
| `tithe_conduit` | any Conduit match | +1 shop gold, +8 score | Conduit already pays score for adjacency; this adds the purse, not more adjacency reading. |
| `bulwark_plate` | any Heavy match | +1 guard token, or +18 score at the cap | Same token economy and cap as `guard_token_plus_one`, keyed to a trait rather than to pickup. |
| `stasis_broker` | any Stasis match | +1 full-board shuffle charge | Turns the blocking trait into supply; barred under `noShuffle` like the other shuffle relics. |
| `echo_relay` | Echo match with an adjacent Heavy tile | +1 flash pair | Adjacency-gated, so it competes with Echo's other pairings rather than stacking on all of them. |
| `drift_appraiser` | Drift match with an adjacent Cursed tile | +2 shop gold, +15 score | Pays for entering the cursed lane; `parasite_ledger` pays for surviving the parasite, not for the risk. |

Draft weights sit a notch under the equivalent-rarity charge relics: a rule that fires all run is worth more than a number that fires once. `opening_ledger` and `tithe_conduit` are in the demo pool so a demo player sees what the class is; the other four are full-game only.

## Expansion candidates (deferred)

- “Score multiplier” — overlaps mutator `score_parasite` design space; prefer mutators for scoring.  
- “Extra life at draft” — overlaps streak/guard healing; avoid unless run economy is retuned.

## Draft flow (B2)

After clearing floors **3, 6, 9, 12, …** (every 3 from 3), up to **12 milestone visits** per run (`relicTiersClaimed` caps visits; a visit may grant **multiple** relics via `picksRemaining` / `bonusRelicPicksNextOffer`): `needsRelicPick` + `openRelicOffer` → UI in `GameScreen` (`RelicDraftOfferPanel`) → `pickRelic` / `completeRelicPickAndAdvance`. **Puzzle** mode skips offers.

Each **round** shows up to **three** distinct options from `RELIC_DRAFT` in `relics.ts`: rarity + base weight; `effectiveRelicDraftWeight(id, tierIndex)` scales by milestone tier. Scheduled Endless drafts first guarantee one contextual spotlight when an eligible relic fits the current/next chapter, active risk wager, or near-complete Favor bank; the remaining slots still use weighted selection. `pickRound` rerolls a fresh trio when the player still owes picks. Selection uses `pickWeightedWithoutReplacement` (`weightedPick.ts`) with a run-seeded RNG (`runSeed`, tier, floor, `pickRound`). Contract hard filters remove shuffle relics under `noShuffle` and `destroy_bank_plus_one` under `noDestroy`.
