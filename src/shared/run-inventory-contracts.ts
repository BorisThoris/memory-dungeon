export type RunInventoryItemId =
    | 'meteor_charge'
    | 'crucible_charge'
    | 'storm_glass_charge'
    | 'still_bell_charge'
    | 'shuffle_charge'
    | 'region_shuffle_charge'
    | 'peek_charge'
    | 'flash_pair_charge'
    | 'undo_charge'
    | 'gambit_token'
    | 'wild_match_token'
    | 'mutator_loadout'
    | 'contract_loadout';

export const RUN_INVENTORY_ITEM_IDS = [
    'meteor_charge',
    'crucible_charge',
    'storm_glass_charge',
    'still_bell_charge',
    'shuffle_charge',
    'region_shuffle_charge',
    'peek_charge',
    'flash_pair_charge',
    'undo_charge',
    'gambit_token',
    'wild_match_token',
    'mutator_loadout',
    'contract_loadout'
] as const satisfies readonly RunInventoryItemId[];
