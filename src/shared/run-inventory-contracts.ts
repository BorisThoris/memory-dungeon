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
    'mutator_loadout',
    'contract_loadout'
] as const satisfies readonly RunInventoryItemId[];
