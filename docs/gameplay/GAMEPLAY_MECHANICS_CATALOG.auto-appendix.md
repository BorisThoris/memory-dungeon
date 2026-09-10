# Gameplay mechanics — machine snapshot

**Generated:** 2026-09-10T21:26:54.909Z

> Regenerate with `yarn docs:mechanics-appendix`. Do not edit by hand.

| Constant / count | Value |
| --- | --- |
| `GAME_RULES_VERSION` | 49 |
| `ENCYCLOPEDIA_VERSION` | 41 |
| Mutator entries (`MUTATOR_CATALOG`) | 10 |
| Achievement entries (`ACHIEVEMENT_CATALOG`) | 17 |
| `GameMode` codex ids | endless |

## System refinement ledger

Every system in the game, with the last generation that passed over it. 23 changed, 24 confirmed already in their refined state, 1 removed outright.

| System | Verdict | Gen | What was found |
| --- | --- | --- | --- |
| `board.chain_chunk_fever` | confirmed | 201 | Ladder measured at none 1.72 / clean 2.19 / sharp 6.03 / fever 8.64 pairs per match, spread 6.93, and the multiplier climbs strictly at every rung. sim:cascade and sim:pop both hold their bands. |
| `board.cleanup` | confirmed | 201 | The pop takes only cards in contact (Gen 197) and the drop fires on 0.177 of chain-one matches at 1.17 pairs a drop. Both numbers come from sim:pop rather than from the rule being read back. |
| `core.board_turn_resolution` | confirmed | 201 | Occupancy 1.000 x 4.95 on the reference pass: every floor resolves turns, which is the one row in the census that would be alarming at any other value. |
| `objective.floor_clear` | changed | 201 | The in-run line at zero remaining pairs said "Next: exit is ready." There is no exit; a floor ends when the board does. It now says the floor is clear. |
| `trait.echo` | changed | 205 | Occupancy 0.392, banded common. Pays in peek charges, which is a currency the run still spends - the peek reads 1.000 on the tooled pass. Gen 205: it was the rarest of the four at 0.342, because two of the three interaction couples spend Conduit and Stasis and the fill that was meant to even the floor out drew uniformly instead. |
| `trait.heavy` | changed | 201 | Its mismatch line promised "costs +1 extra try but never drains peek charges". Nothing in the game drains a peek charge on a mismatch, so the clause promised the absence of an impossible penalty. Cut; the true half stayed. |
| `trait.conduit` | changed | 202 | Its Echo payoff line, "Conduit + Echo: peek spark", was being sorted into a lane called Shard and drawn on the card back as a combo shard - a currency removed in Gen 184. It reads Tool now, which is what a returned peek charge is. |
| `trait.stasis` | confirmed | 202 | Occupancy 0.512, banded common. Both its interaction lines land in the block lane, which is what a lock does, and the lane survived the Gen 202 cull on evidence. |
| `power.peek` | confirmed | 208 | Occupancy 0.904 across whole runs, banded core, and it is the one run-scoped charge that clears that bar honestly: a run starts with a single peek and three of the floor curios grant another, so the charge keeps coming back. Read a floor at a time it was 1.000, which was true of 240 first floors rather than of a run (Gen 207). |
| `power.pin` | changed | 201 | Re-banded core to common. It read 1.000 while the census pressed it at floor open regardless of the board; pressed after a miss, where a pin has a reason, it reads 0.158 - the reference miss rate. |
| `power.flash_pair` | changed | 207 | Re-banded common -> rare at Gen 207. A setup charge the run hands out once and never refills: 0.042 of the floors in a run against the 0.158 a fresh run every floor reported. Rare is what a once-a-run charge is. |
| `power.tile_swap` | changed | 201 | Stays core, but now on evidence: 0.988, because nearly every board deals a pair whose halves are not touching. Before, it was pressed unconditionally and read 1.000 by construction. |
| `power.shuffle` | changed | 207 | Re-banded core -> common at Gen 207. It read 1.000 of floors on a census that built a fresh run for every floor; across a real run it is 0.196, because a run starts with one shuffle charge and only one floor curio grants another. Nothing about the tool changed - the band was describing the instrument. Its Codex entry was repointed in Gen 201: a Scholar contract disables board shuffle and nothing else, which is what the code does. Gen 205 moved the census press off the halfway mark, where a break that empties the board in one turn skips it entirely. |
| `power.region_shuffle` | confirmed | 205 | Occupancy 1.000, banded core - it sat at exactly 0.900 against a 0.900 bar until Gen 205 asked what the missing tenth was, and it was the census pressing at a moment a cascade can skip. It sets shuffleUsedThisFloor like the full shuffle, so the scholar-style objective catches it - checked against the rule, not the field name. |
| `power.undo_resolve` | confirmed | 201 | Occupancy 0.475, banded common, and correctly bounded: undo only exists while a pair is resolving, so it cannot exceed the miss rate by much. |
| `power.gambit` | confirmed | 201 | Occupancy 0.446, banded common. One third flip per floor, spent on the first miss, which is the only moment it can be spent. |
| `power.wild_match` | changed | 207 | Re-banded core -> rare at Gen 207, and it is the clearest thing the run census found: the joker read 1.000 x 1.00 of floors because the census built a new setup run for every floor, and across a real run it is spent on floor 1 and never seen again, on all ten seeds. That is the setup sheet working exactly as written - one joker a run - so the power is unchanged and the claim about it is. |
| `inventory.peek_charge` | confirmed | 201 | Spent as a fall rather than read as a value, so an Echo refund mid-floor cannot hide a spend. That distinction is the reason the census reports charges the way it does. |
| `inventory.shuffle_charge` | confirmed | 201 | One charge, one dock tool, one spend path; the run-shell tool catalog gate proves no charge field exists without a tool that spends it. |
| `inventory.region_shuffle_charge` | confirmed | 201 | Shared by the row shuffle and the tile swap, which is why the census gives them separate counter ids on separate passes rather than one row. |
| `inventory.flash_pair_charge` | confirmed | 201 | Granted by a run setup rather than a plain endless run, which is exactly why the setup pass exists; its spend now tracks the flash at 0.158. |
| `inventory.undo_charge` | confirmed | 201 | A per-floor budget rather than a run charge. RUN_TOOL_REASONS.undo tells the player the one condition - a pair mid-resolution - and the dock takes its enabled state from the same rule. |
| `inventory.gambit_token` | confirmed | 201 | A per-floor flag, read through the census as 0 or 1 rather than as a tally, because the gambit either happened on a floor or did not. |
| `inventory.wild_match_token` | confirmed | 200 | The token and the joker tile are two halves of one system and now move together at 1.000 on the setup pass. |
| `board.wild_joker_tile` | confirmed | 200 | The last singleton in the game. Gen 196 removed the decoy, the exit, the lever and the shop door; SINGLETON_UTILITY_PAIR_KEYS is now exactly one key, pinned by a test. |
| `phase.memorize` | confirmed | 201 | Exempt from the census by argument rather than omission: every floor opens with it, so a counter would read 1.00 on every row and prove nothing. |
| `hazard.magpie_thief` | changed | 208 | Occupancy 0.013 across whole runs, banded rare, and until Gen 208 it had no counter at all and was not in the interaction graph - so the ledger's claim to cover every system in the game had never covered the one mechanic that takes finished work back off the player. The floor census reads it SILENT, which is true of 240 first floors and false of the game: the bird arrives on every third mismatch OF THE RUN, so a census that starts a new run every floor almost never reaches it. It is announced when it steals (Gen 113) and the graph now records that reader. |
| `safety.softlock_fairness` | confirmed | 201 | A guarantee rather than an occurrence, so its gate is the softlock seed sweep - 0 issue floors across the endless health check - not an occupancy row. |
| `findable.score_glint` | changed | 202 | Its reward row carried a destroyText field saying Destroy forfeits the score. Replaced with the rule that is true: a break which takes the carrier spills the glint and pays it. |
| `objective.featured_streak` | changed | 201 | The scholar-style objective told the player "no shuffle, swap, or destroy" while its rule watched one field. The field turned out to cover swap too, so only the dead third was cut. |
| `economy.score_and_rewards` | confirmed | 201 | The economy row projection lists score, findable pickups and assist charges, and it lost Destroy and Stray in Gen 200 rather than showing them at zero. |
| `stats.session_tracking` | changed | 202 | pairsDestroyed could only ever be zero once Destroy left - it had no other writer. The field, its normalizer entry and the long-run feedback branch that listed "destroy pair" among a player’s actions are all gone. |
| `progression.run_flow` | confirmed | 201 | Exempt from the census because it is the frame the census steps; a floor ends when the board is empty, proven by the endless simulation clearing 1.00 of floors at every miss rate. |
| `progression.run_setup` | changed | 200 | A chaos setup granted initialStrayRemoveCharges alongside the joker. Stray is gone, so it grants the joker alone - which is what a chaos run was for. |
| `mode.wild_run` | confirmed | 200 | The one surviving setup flavour. Its Codex entry describes a joker and a different pairing puzzle, which after Gen 200 is the whole of what it does. |
| `inventory.mutator_loadout` | changed | 201 | Exempt from the census as a pre-floor choice, but its documentation still listed score_parasite, removed in Gen 183. MUTATORS.md now lists the ten in MUTATOR_IDS and says why the eleventh went. |
| `inventory.contract_loadout` | changed | 200 | The noDestroy clause went with Destroy, so a Scholar contract is a no-shuffle contract. Every Codex sentence that said otherwise was repointed. |
| `persistence.run_summary` | confirmed | 201 | Written once when a run ends, so the floor census cannot see it; the save-field policy gate covers it instead, and no removed field is written back. |
| `core.gameplay_commands` | changed | 200 | The simulation drew from a slot range with a dead slot in it after the destroy and stray commands left, wasting one pick in every n on nothing. The slots were compacted. |
| `feedback.gameplay_hud` | changed | 202 | Twenty-one branches of the in-run feedback rail watched for announcements the game cannot produce - guard caches, patrol paths, shop gold. Removed, and gateed so no branch can outlive its announcement. |
| `simulation.gameplay_replay` | confirmed | 200 | A tool for verifying the game rather than a rule in it. Its 384-step run stays deterministic and schema-clean after the command slots were compacted. |
| `simulation.build_evaluation` | confirmed | 201 | A tool for tuning rather than a rule. It is the thing that produced the re-bands in this ledger, which is the argument for exempting it from being censused by itself. |
| `surface.floor_identity_coaching` | changed | 201 | The four sentences a player reads on the floor they are standing on taught traps, disarms, keys, locks, guard, the parasite clock and finding the exit. Rewritten around what an archetype now decides: whether the suits are clumped, scattered or two-suit. |
| `surface.boss_identity` | changed | 201 | Promised +2 Favor, a currency removed in Gen 175, and a Keystone Pair board anchor that exists nowhere in the game - in a string shown in the HUD title. |
| `surface.trait_interaction_lanes` | changed | 202 | Seven lanes for four interactions. The shard, guard and risk lanes went with their colours, their card-back marker meshes and their beat tiers. |
| `surface.codex` | changed | 201 | Eleven entries still taught Destroy and Stray the day after both were removed: findables, powers, dense pickups, shifting spotlight, charges, perfect memory, recall focus, the scholar objective and the scholar contract. |
| `surface.audio` | changed | 200 | Two sampled effects and their manifest rows went with the powers that played them, along with the OGG and WAV files. The audio coverage gate confirms every remaining cue has a manifest entry and a file. |
| `surface.removed_powers` | removed | 200 | Destroy could never be pressed - no code path grants a charge - and Stray had only one legal target left, the wild joker, so pressing it deleted the player’s own wild match. Recorded in docs/REMOVED_POWERS.md. |
