# Pickup matrix (`RelicId` × draft)

Draft tier (`RelicDraftRarity` in [`relics.ts`](../../../src/shared/relics.ts)) drives **weights + tier scaling**, not the in-run effect strength. Visual tier on the card matches this draft tier.

| RelicId | Draft rarity | Effect (short) |
|---------|--------------|----------------|
| `extra_shuffle_charge` | common | +1 shuffle charge now |
| `first_shuffle_free_per_floor` | common | First full-board shuffle each floor free |
| `memorize_bonus_ms` | common | Longer memorize phases |
| `region_shuffle_free_first` | common | First row shuffle or tile swap each floor free |
| `memorize_under_short_memorize` | uncommon | +memorize when Short memorize mutator active |
| `destroy_bank_plus_one` | uncommon | +1 destroy charge now |
| `combo_shard_plus_step` | uncommon | +1 combo shard step |
| `peek_charge_plus_one` | uncommon | +1 peek charge |
| `parasite_ward_once` | rare | Ward next parasite life loss |
| `stray_charge_plus_one` | rare | +1 stray remover charge |
| `pin_cap_plus_one` | rare | +1 max pinned tiles |
| `guard_token_plus_one` | rare | +1 guard token (capped) |
| `shrine_echo` | uncommon | +1 pick budget at **next** shrine only |
| `chapter_compass` | uncommon | Stronger scheduled Endless contextual drafts |
| `wager_surety` | rare | Risk wager +1 Favor and x1 bust floor |
| `parasite_ledger` | uncommon | Successful parasite objective slows parasite pressure |

See [`RELIC_ROSTER.md`](../../RELIC_ROSTER.md) for full behavior and overlap notes.
