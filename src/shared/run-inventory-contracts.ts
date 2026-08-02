export type RunInventoryItemId =
    | 'shuffle_charge'
    | 'region_shuffle_charge'
    | 'destroy_charge'
    | 'peek_charge'
    | 'stray_remove_charge'
    | 'flash_pair_charge'
    | 'undo_charge'
    | 'gambit_token'
    | 'wild_match_token'
    | 'iron_key'
    | 'master_key'
    | 'guard_token'
    | 'combo_shard'
    | 'relic_loadout'
    | 'mutator_loadout'
    | 'contract_loadout';

export const RUN_INVENTORY_ITEM_IDS = [
    'shuffle_charge',
    'region_shuffle_charge',
    'destroy_charge',
    'peek_charge',
    'stray_remove_charge',
    'flash_pair_charge',
    'undo_charge',
    'gambit_token',
    'wild_match_token',
    'iron_key',
    'master_key',
    'guard_token',
    'combo_shard',
    'relic_loadout',
    'mutator_loadout',
    'contract_loadout'
] as const satisfies readonly RunInventoryItemId[];
