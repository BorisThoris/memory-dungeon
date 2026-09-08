# The dungeon layer, archived

> Generated from the catalogs themselves by a script that ran on the commit before they were deleted
> (`8d9d3f8c`), and static since Gen 176 took the catalogs and the script with them. Nothing here is
> remembered or paraphrased: every row is the definition the game shipped.

## Why it was removed

The dungeon layer put a second game on top of the memory board: a key you had to find before a lock, a lever
you had to pull before an exit, a shop you had to open, a trap that punished a flip, a decoy that lied about
what a tile was. Every one of those is a **stop**. The loop this game is actually about — flip, match, pop,
ripple, drop, climb, Fever — is a loop of **momentum**, and a stop inside it is a place the player puts the
game down.

The measurements had been saying so for a while without anyone reading them that way:

- The dungeon budget took the floor's entire pair count, so the pop had nothing to touch (Gen 167).
- The trim deciding which cards survived a capacity cut needed four passes of protection to stop floors
  losing the card their own archetype was named for (Gen 168).
- Eleven systems in this layer fire on no floor a player ever plays, and have their own standing tasks
  against them (the occupancy census, `sim:occupancy`).

It was expensive, it was fragile, and it was in the way.

## How the removal was staged

It happened in six generations rather than one commit, because the interesting failure is not "does it still compile"
but "does the game still end":

1. **Gen 171 — one mode.** `GameMode` collapsed to `endless`; daily, puzzle, meditation and gauntlet went,
   with the three balance terms they had quietly been carrying written down in `BALANCE_NOTES.md`.
2. **Gen 172 — generation stops dealing it.** Board generation no longer places a card recipe, a filler pass,
   an exit, a shop, a room, a hazard pass or the layout plan that pinned them. A generated floor is pairs and
   nothing else, asserted over 768 boards in `board-build-rules.test.ts`. This is the commit that matters:
   the modules below still existed and still worked, and the game had already stopped being the game they
   described.
3. **Gen 173 — no door between floors.** The route offer, its gateway and side-room stops, and the run
   events behind them are removed at the source: a cleared floor goes straight to the next one. The route
   modules listed first at the end are deleted in this commit; a `route.choose` or `side_room.resolve`
   command in an old journal is rejected with a reason rather than replayed.
4. **Gen 174 — nothing purchasable.** Gold has no source and no sink: a cleared floor pays none, a match
   pays none, the momentum ladder pays none, and the vendor - the floor-clear shop and the one opened from
   the board - is gone with the store dock button, the shop view and the shop rules. The wallet reads
   nought on every run. The shop modules listed second at the end are deleted in this commit.
5. **Gen 175 — no draft, no loadout.** The milestone relic draft never opens, the four starting loadouts
   are gone from run creation, and the build-strategy simulations that drafted against them are deleted
   with the draft surface, its store slice and its copy. A `relic.offer_open`, `relic.pick` or
   `relic.offer_service_use` command in an old journal is rejected with a reason. The second half of the
   same generation cuts what fed the draft: Favor is no longer earned anywhere, the Endless risk wager that
   staked a streak for Favor is gone, and the Collection, achievements, honors, quests and Profile upgrade
   that counted relic picks are gone with it. The relic definitions and their in-play effects go with the
   dungeon modules.
6. **Gen 176 — the dungeon modules go.** The `dungeon-*` files listed last at the end are deleted, with the
   hazard-tile and roaming-hazard modules, the dungeon run map, the relic definitions and their in-play
   effects, the bonus rewards and the build perks; every branch in the turn path that called them goes
   too. A `dungeon.exit_activate`, `enemy_hazard.contact` or `floor.hazard_banish` command in an old
   journal is dropped on load. The second half of the same generation strips the run, board and tile
   fields and the save shape that carried all of it (save schema 7, rules version 34): a profile written
   by an older build loads with its records intact and none of the removed fields, a journal entry
   naming a removed command fails its schema and is dropped, and nothing is migrated forward. The two
   pickups that only acted on the layer, the ward spark and the scout glint, went with it.

## How to get any of it back

Everything here is in git. The removal commits carry `Gen 171` through `Gen 176` in their messages,
and each section names the module a definition lived in, so `git log --all -- src/shared/<module>.ts` finds
its whole history. The intent is not that none of this returns — it is that it returns **deliberately, one
mechanic at a time, measured against the loop** rather than layered on top of it.

## What removing it actually did

Two numbers, both from the repository's own simulations, run immediately before and after the Gen 172 cut:

- **Fever share went from ~0.13 to 0.51 of floors** for a clean player (`yarn sim:cascade`). The dungeon
  budget had been eating the pairs the pop needed to reach, so the cascade could not build. This is the
  thesis's central claim, and it is the first time it has been measured rather than argued.
- **The occupancy census went fully green** (`yarn sim:occupancy`). Eleven systems had been listed as
  silent — shipped and never observable — for eleven generations. They are not quiet now; they are gone,
  which is a different and more honest answer than a widened band.

## Card kinds

From `src/shared/dungeon-cards.ts`. `memoryTax` is what the kind cost the player in things to remember.

| Kind | Family | Rules role | Revealed | Match reward | Mismatch cost | Memory tax | Help text |
|---|---|---|---|---|---|---|---|
| `enemy` | Enemy | HP-bearing card pair that can be defeated by matching. | `on_flip` | `combat` | `enemy_attack` | 3 (core_safe) | Match both enemy cards to defeat the encounter and earn combat rewards. |
| `trap` | Trap | Armed hazard pair that punishes mismatches until disarmed. | `on_flip` | `disarm` | `trap_trigger` | 4 (core_safe) | Revealed traps stay armed until their matching card is found. |
| `treasure` | Treasure | Reward pair that pays score and shop gold. | `on_pair_match` | `loot` | `none` | 1 (core_safe) | Treasure cards are optional rewards that improve the run economy. |
| `shrine` | Shrine | Support pair that grants guard and relic favor. | `on_pair_match` | `guard` | `none` | 2 (core_safe) | Shrines provide defensive and progression rewards when matched. |
| `gateway` | Gateway | Route-selection pair for shaping the next floor. | `on_pair_match` | `route` | `missed_route_information` | 3 (core_safe) | Gateways select or reinforce the route profile for the next floor. |
| `key` | Key | Inventory pair that banks a dungeon key. | `on_pair_match` | `key` | `none` | 1 (core_safe) | Keys open locked exits, caches, and rooms depending on the current floor. |
| `lock` | Lock | Gated reward pair that spends a key for full loot. | `on_pair_match` | `unlock` | `delayed_access` | 4 (core_safe) | Locks can become loot if the run has a matching key available. |
| `exit` | Exit | Singleton floor objective that must be activated to complete dungeon floors. | `manual_reveal` | `exit` | `delayed_access` | 4 (core_safe) | Exits are singleton utility cards gated by reveal state, levers, or keys. |
| `lever` | Lever | Floor-local switch pair for exits and trap-control effects. | `on_pair_match` | `unlock` | `none` | 2 (core_safe) | Levers satisfy floor-local locks or seal revealed traps. |
| `shop` | Shop | Singleton vendor access point. | `manual_reveal` | `service` | `none` | 1 (core_safe) | Shops open floor-local offers and can be revisited while the floor is active. |
| `room` | Room | Singleton interactable room with a deterministic service. | `manual_reveal` | `room` | `delayed_access` | 4 (core_safe) | Rooms provide one-shot services such as healing, scouting, keys, or trap work. |

### Memory tax by axis

The cost each kind put on the thing the game is actually about — and the finding that matters most in this
whole archive: **every single kind scored `core_safe`.** The taxonomy that was supposed to catch content
taxing the memory game said all eleven kinds were fine. They were, individually. What none of the axes could
see is that eleven individually-cheap stops, stacked, are a different game — and that the cost was never
really to memory, it was to *momentum*, which nothing here measures. That is the lesson worth keeping when
any of this is weighed for return: score the loop, not just the recall.

| Kind | informationBypass | spatialDisruption | mistakeRecovery | hiddenPunishment | boardCompletionRisk | uiComprehensionLoad | Total | Band |
|---|---|---|---|---|---|---|---|---|
| `enemy` | 0 | 0 | 0 | 1 | 1 | 1 | 3 | core_safe |
| `trap` | 0 | 0 | 0 | 1 | 1 | 2 | 4 | core_safe |
| `treasure` | 0 | 0 | 0 | 0 | 0 | 1 | 1 | core_safe |
| `shrine` | 0 | 0 | 1 | 0 | 0 | 1 | 2 | core_safe |
| `gateway` | 1 | 0 | 0 | 0 | 0 | 2 | 3 | core_safe |
| `key` | 0 | 0 | 0 | 0 | 0 | 1 | 1 | core_safe |
| `lock` | 0 | 0 | 0 | 0 | 2 | 2 | 4 | core_safe |
| `exit` | 0 | 0 | 0 | 0 | 2 | 2 | 4 | core_safe |
| `lever` | 0 | 0 | 0 | 0 | 1 | 1 | 2 | core_safe |
| `shop` | 0 | 0 | 0 | 0 | 0 | 1 | 1 | core_safe |
| `room` | 1 | 0 | 0 | 0 | 1 | 2 | 4 | core_safe |

### What each kind contributed to

| Kind | Objectives it advanced | Mechanic tokens |
|---|---|---|
| `enemy` | `defeat_boss`, `pacify_floor` | `risk`, `objective`, `reward`, `resolved` |
| `trap` | `disarm_traps`, `reveal_unknowns` | `risk`, `armed`, `resolved`, `forfeit` |
| `treasure` | `loot_cache` | `reward`, `forfeit` |
| `shrine` | — | `safe`, `reward`, `momentum` |
| `gateway` | `claim_route` | `objective`, `hidden_known`, `reward` |
| `key` | `loot_cache` | `reward`, `cost` |
| `lock` | `loot_cache` | `locked`, `cost`, `reward`, `forfeit` |
| `exit` | `find_exit`, `open_bonus_exit`, `claim_route` | `objective`, `locked`, `resolved` |
| `lever` | `find_exit`, `disarm_traps` | `objective`, `resolved`, `safe` |
| `shop` | — | `cost`, `reward` |
| `room` | `loot_cache`, `reveal_unknowns` | `cost`, `reward`, `hidden_known` |

## Card effects

From `src/shared/dungeon-cards.ts`. Each effect is one concrete card a floor could deal.

| Effect | Kind | Label | Rules role | Help text |
|---|---|---|---|---|
| `enemy_sentry` | `enemy` | Archivist Sentry | Baseline enemy card pair. | A low-HP enemy defeated by matching its pair. |
| `enemy_elite` | `enemy` | Mnemonic Sentinel | Higher-HP enemy or boss card pair. | A stronger enemy that may represent the floor boss. |
| `enemy_stalker` | `enemy` | Afterimage Stalker | Enemy card pair that wakes when traps spring. | A hidden enemy that becomes dangerous when trap pressure escalates. |
| `trap_spikes` | `trap` | Spike Plate | Baseline armed trap. | A revealed trap that should be matched quickly to disarm. |
| `trap_curse` | `trap` | Curse Sigil | Trap pressure for shadow floors. | A trap tuned for information-denial floors. |
| `trap_mimic` | `trap` | Mimic Bounty | Trap that pays loot when disarmed. | A visible risk-reward trap: destroy removes danger but forfeits the bounty; matching pays once. |
| `trap_alarm` | `trap` | Bell Trap | Trap that wakes hidden enemies. | Mismatches while it is armed wake hidden enemy cards. |
| `trap_snare` | `trap` | Latch Snare | Trap that consumes defensive tempo. | Mismatches can spend guard or disable free shuffle help. |
| `trap_hex` | `trap` | Forgetful Hex | Trap that cuts score and reveals hazards. | Mismatches punish score and expose more dungeon pressure. |
| `treasure_gold` | `treasure` | Coin Memory | Baseline treasure reward. | Pays score and shop gold when matched. |
| `treasure_cache` | `treasure` | Gallery Cache | Larger treasure reward. | Pays a larger cache reward and objective credit. |
| `treasure_shard` | `treasure` | Supply Niche | Small supply reward. | Pays a modest score and gold reward. |
| `shrine_guard` | `shrine` | Guard Shrine | Defensive shrine reward. | Adds guard up to the cap and relic Favor, then resolves once. |
| `gateway_safe` | `gateway` | Safe Gateway | Safe route selector. | Points the run toward recovery and lower pressure. |
| `gateway_greed` | `gateway` | Greed Gateway | Greed route selector. | Points the run toward higher reward and higher pressure. |
| `gateway_mystery` | `gateway` | Mystery Gateway | Mystery route selector. | Points the run toward events and information variance. |
| `gateway_depth` | `gateway` | Depth Gateway | Default dungeon route selector. | Pushes the run deeper through the selected dungeon route. |
| `key_iron` | `key` | Iron Memory Key | Standard key reward. | Banks an iron key for a future lock. |
| `key_master` | `key` | Master Key | Universal key reward. | Represents a key that can open any one keyed lock. |
| `lock_cache` | `lock` | Sealed Cache | Key-gated loot cache. | Spends a key for full cache rewards, or pays only a small fallback when no key is available. |
| `exit_safe` | `exit` | Safe Exit | Safe route exit. | Completes the floor and favors a safer next node. |
| `exit_greed` | `exit` | Greed Exit | Greed route exit. | Completes the floor and favors a riskier reward route. |
| `exit_mystery` | `exit` | Mystery Exit | Mystery route exit. | Completes the floor and favors an event-heavy route. |
| `exit_boss` | `exit` | Boss Exit | Boss floor exit. | Completes a boss floor after its blockers are handled. |
| `lever_floor` | `lever` | Exit Lever | Lever-lock progress. | Counts toward a lever-locked exit. |
| `rune_seal` | `lever` | Rune Seal | Trap-control lever. | Seals revealed traps when matched. |
| `shop_vendor` | `shop` | Vendor | Shop access. | Opens the floor vendor. |
| `room_campfire` | `room` | Mnemonic Hearth | Room healing service. | Restores life or grants recovery value. |
| `room_fountain` | `room` | Stillwater Font | Room guard service. | Adds guard-oriented safety. |
| `room_map` | `room` | Cartographer Cell | Room scouting service. | Reveals scoped utility-family information without identifying exact pair solutions. |
| `room_forge` | `room` | Breaker Forge | Room upgrade service. | Improves run tools or rewards. |
| `room_shrine` | `room` | Whisper Shrine | Room favor service. | Grants relic favor or shrine-style progression. |
| `room_scrying_lens` | `room` | Scrying Lens | Room reveal service. | Reveals a scoped dungeon family clue without paying match rewards. |
| `room_armory` | `room` | Recall Armory | Room combat service. | Adds combat safety or damage pressure relief. |
| `room_locked_cache` | `room` | Sealed Cache Cell | Room key-gated loot service. | Stays revealed until its matching key or a master key is spent for the full cache reward. |
| `room_key_cache` | `room` | Key Niche | Room key service. | Grants an iron key and score. |
| `room_trap_workshop` | `room` | Trapwright Bench | Room trap-control service. | One-shot room that resolves an armed trap pair, otherwise reveals a hidden trap family clue. |
| `room_omen_archive` | `room` | Omen Archive | Room information and favor service. | Grants favor and reveals a hidden dungeon pair. |

## Bosses

From `src/shared/dungeon-boss-rules.ts`.

| Id | Label | Symbol | HP | Hazard | Pattern | Signature | Reward hook |
|---|---|---|---|---|---|---|---|
| `trap_warden` | Latch Warden | `W` | 3 | `warden` | `guard` | Guard pattern prioritizes traps, locks, keys, levers, and reward-adjacent pressure. | Defeat breaks the latch for guard, score, and Favor. |
| `rush_sentinel` | Bell-Rush Sentinel | `S` | 3 | `sentinel` | `patrol` | Patrol pattern rotates pressure across active non-utility cards. | Defeat stills the bell for a combo shard, bonus score, and Favor. |
| `treasure_keeper` | Gilded Keeper | `K` | 3 | `warden` | `guard` | Guard pattern favors treasure, key, lever, and lock cards. | Defeat opens the ledger for shop gold, treasure progress, score, and Favor. |
| `spire_observer` | Mnemonist Observer | `O` | 3 | `observer` | `observe` | Observe pattern prioritizes boss, enemy, and trap encounter cards. | Defeat closes the gaze for extra Favor and score. |

### Boss card copy

- **Latch Warden** — Defeat the Latch Warden for score, guard, and Favor.
- **Bell-Rush Sentinel** — Defeat the Bell-Rush Sentinel for score, a combo shard, and Favor.
- **Gilded Keeper** — Defeat the Gilded Keeper for score, shop gold, and Favor.
- **Mnemonist Observer** — Defeat the Mnemonist Observer for extra Favor.

## Hazard tiles

From `src/shared/hazard-tiles.ts`. These are the decoys, snares and fake caches - the tiles that lied.

| Kind | Label | Family | Trigger | Outcome | What it told the player |
|---|---|---|---|---|---|
| `shuffle_snare` | Shuffle Snare | `penalty` | `mismatch` | `shuffle_hidden_preview` | Wrong pairs reshuffle safe hidden tiles. |
| `cascade_cache` | Cascade Cache | `reward` | `match` | `cascade_remove_preview` | Clean matches clear one safe hidden pair. |
| `mirror_decoy` | Mirror Decoy | `dual` | `mismatch` | `decoy_misdirect_preview` | Suspicious singleton: copied symbol, no valid pair. |
| `fragile_cache` | Fragile Cache | `reward` | `match_or_mismatch` | `fragile_cache_preview` | Clean match pays a bonus; a mismatch breaks the cache. |
| `toll_cache` | Toll Cache | `dual` | `match` | `toll_cache_preview` | Clean match pays shop gold but takes a small score toll. |
| `fuse_cache` | Fuse Cache | `dual` | `match` | `fuse_cache_preview` | Claim in the first three resolutions for full payout. |

### What each hazard did in full

- **Shuffle Snare** (`shuffle_snare`)
  - Fires on: First resolving mismatch that includes either snare tile.
  - Telegraph: Warns that a wrong pair reshuffles safe hidden tiles.
  - Outcome: Mismatch reshuffles safe hidden tiles and clears stale pins only when the snare actually fires.
  - Targeting: May move only hidden normal tiles, never exits, decoys, dungeon cards, route cards, pickups, or other hazards.
  - Objective interaction: Counts as a hazard trigger; does not spend player shuffle charges or change objective completion directly.
  - Enabled in normal runs: yes
- **Cascade Cache** (`cascade_cache`)
  - Fires on: Successful pair match that includes both cache tiles.
  - Telegraph: Shows that a clean match removes one safe hidden pair.
  - Outcome: Clean match removes one complete safe hidden pair and advances board completion.
  - Targeting: May remove only a complete hidden normal pair, never exits, decoys, dungeon cards, route cards, pickups, or other hazards.
  - Objective interaction: Counts as a hazard trigger and match momentum; never claims featured objective credit for the removed pair.
  - Enabled in normal runs: yes
- **Mirror Decoy** (`mirror_decoy`)
  - Fires on: Mismatch involving the singleton mirror tile.
  - Telegraph: Marks a suspicious singleton that copies a nearby symbol but never counts as a pair.
  - Outcome: A mismatch involving the copied-symbol decoy may leave it face-up without blocking floor completion.
  - Targeting: Never targets another tile; it is itself the singleton decoy and cannot become an exit or valid pair.
  - Objective interaction: Counts as a hazard trigger only on mismatch paths and can fail glass-witness style objectives like other decoy exposure.
  - Enabled in normal runs: yes
- **Fragile Cache** (`fragile_cache`)
  - Fires on: Clean match claims the cache; mismatch involving either cache tile breaks the bonus.
  - Telegraph: Shows a greed cache that pays only if matched cleanly before a mismatch touches it.
  - Outcome: Clean match pays the fragile bonus; mismatch breaks only the bonus marker and preserves board completion.
  - Targeting: Targets no other tile; mismatch removes only this pair hazard marker and never changes exits, decoys, rewards, or objectives.
  - Objective interaction: Counts as a hazard trigger; clean claim can help score goals while a mismatch can forfeit flip-par pacing.
  - Enabled in normal runs: yes
- **Toll Cache** (`toll_cache`)
  - Fires on: Successful pair match that includes both toll cache tiles.
  - Telegraph: Shows a greed cache that converts part of the match score into shop gold.
  - Outcome: Clean match pays shop gold by converting part of that match score; bypassing it denies the payout.
  - Targeting: Targets no other tile; it only changes the matched pair payout and never spends scarce resources silently.
  - Objective interaction: Counts as a hazard trigger; can help economy while making score-based objectives tighter.
  - Enabled in normal runs: yes
- **Fuse Cache** (`fuse_cache`)
  - Fires on: Successful pair match; full payout only during the first three floor resolutions.
  - Telegraph: Shows a greed cache whose full payout expires after three resolutions.
  - Outcome: Clean match pays a timed greed reward; after the fuse expires, the pair still matches for a smaller payout.
  - Targeting: Targets no other tile; it only changes the matched pair payout and never changes board completion.
  - Objective interaction: Counts as a hazard trigger; rewards fast clean extraction while normal mismatch and flip-par pressure still apply.
  - Enabled in normal runs: yes

## The route layer, which went first

Deleted in Gen 173, with the route offer itself. `git log --all -- <path>` is its whole history.

- `src/shared/route-card-plan-rules.ts`
- `src/shared/route-card-reward-rules.ts`
- `src/shared/route-choice-outcome-rules.ts`
- `src/shared/route-choice-rules.ts`
- `src/shared/route-rules.ts`
- `src/shared/route-side-room-rules.ts`
- `src/shared/route-world.ts`
- `src/shared/run-events.ts`
- `src/shared/copy-tone.ts`
- `src/shared/rest-shrine.ts`
- `src/shared/loaded-gateway-rules.ts`
- `src/renderer/components/SideRoomScreen.tsx`
- `src/renderer/store/sideRoomActionController.ts`
- `src/renderer/store/sideRoomSurfaceState.ts`

## The shop, which went second

Deleted in Gen 174, with the gold it existed to spend. `git log --all -- <path>` is its whole history.

- `src/shared/shop-rules.ts`
- `src/shared/economy-ledger.ts`
- `src/shared/interlude-transition-rules.ts`
- `src/renderer/components/ShopScreen.tsx`
- `src/renderer/store/shopSurfaceState.ts`
- `src/renderer/store/shopCloseExecutor.ts`
- `src/renderer/store/levelCompleteShopExecutor.ts`

## The relic draft and the starting loadouts, which went third

Deleted in Gen 175, with the milestone draft that handed relics out, the four starting loadouts, and
the build-strategy simulations that existed to draft against them. `git log --all -- <path>` is its
whole history.

- `src/shared/relic-offer-open-rules.ts`
- `src/shared/relic-offer-rules.ts`
- `src/shared/relic-pick-advance-rules.ts`
- `src/shared/relic-pick-transition-rules.ts`
- `src/shared/sealed-relic-rules.ts`
- `src/shared/starting-loadouts.ts`
- `src/shared/build-strategy-simulation.ts`
- `src/shared/build-strategy-playthrough-simulation.ts`
- `scripts/sim-build-strategies.ts`
- `scripts/sim-build-strategy-playthroughs.ts`
- `src/renderer/components/RelicDraftOfferPanel.tsx`
- `src/renderer/store/relicOfferSurfaceState.ts`
- `src/renderer/copy/relicDraftOffer.ts`
- `src/shared/relic-favor-rules.ts`
- `src/shared/risk-wager-rules.ts`
- `src/renderer/store/riskWagerSurfaceState.ts`

## The dungeon modules that go with it

Every file below went in the Gen 176 removal, after Gen 172 had already made all of it unreachable from a
generated floor. `git log --all -- <path>` is its whole history. `dungeon-save-migration.ts` is the one
exception: it was never about the dungeon, it is the table saying which save fields need a migration, and
it lives on as `save-field-policy.ts`.

With them, the same commit deleted the modules the list below does not name because they were not called
`dungeon-*`: `hazard-tiles.ts`, `hazard-tile-effect-rules.ts`, `hazard-banisher-rules.ts`,
`enemy-hazard-board-rules.ts`, `run-map.ts`, `relics.ts`, `relic-immediate-rules.ts`,
`trait-build-rewards.ts`, `bonus-rewards.ts`, `route-card-reward-shape.ts`,
`floor-completion-transitions.ts`, the renderer's `dungeonPressSurfaceState.ts`,
`TileBoardEnemyHazardMarker.tsx` and `useGameScreenTraitRouteTargets.ts`, and
`scripts/audit-dungeon-topology.ts`.

- `src/shared/dungeon-blueprint-policy-rules.ts`
- `src/shared/dungeon-board-generation-rules.ts`
- `src/shared/dungeon-board-status.ts`
- `src/shared/dungeon-boss-clear-rules.ts`
- `src/shared/dungeon-boss-rules.ts`
- `src/shared/dungeon-card-read-model.ts`
- `src/shared/dungeon-card-recipe-rules.ts`
- `src/shared/dungeon-cards.ts`
- `src/shared/dungeon-combinatoric-matrix.ts`
- `src/shared/dungeon-e2e-fixtures.ts`
- `src/shared/dungeon-encounter-context-rules.ts`
- `src/shared/dungeon-enemy-card-rules.ts`
- `src/shared/dungeon-enemy-hazard-rules.ts`
- `src/shared/dungeon-exit-rules.ts`
- `src/shared/dungeon-floor-blueprint-rules.ts`
- `src/shared/dungeon-key-copy.ts`
- `src/shared/dungeon-key-rules.ts`
- `src/shared/dungeon-match-reward-rules.ts`
- `src/shared/dungeon-reveal-rules.ts`
- `src/shared/dungeon-room-rules.ts`
- `src/shared/dungeon-room-targeting-rules.ts`
- `src/shared/dungeon-rules.ts`
- `src/shared/dungeon-run-state-rules.ts`
- `src/shared/dungeon-save-migration.ts`
- `src/shared/dungeon-scout-rules.ts`
- `src/shared/dungeon-showcase-run-rules.ts`
- `src/shared/dungeon-tile-augmentation-rules.ts`
- `src/shared/dungeon-topology.ts`
- `src/shared/dungeon-trap-rules.ts`
- `src/shared/dungeon-versioning.ts`

