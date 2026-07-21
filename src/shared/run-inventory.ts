import {
    type DungeonKeyKind,
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    type RunState
} from './contracts';
import { normalizeSessionStats } from './session-stats-rules';

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

export type RunInventoryItemKind = 'consumable' | 'loadout';
export type RunInventoryMutability = 'mid_run' | 'floor_only' | 'shop_or_rest' | 'draft_only' | 'locked';

export interface RunInventoryDefinition {
    id: RunInventoryItemId;
    kind: RunInventoryItemKind;
    label: string;
    stackLimit: number | null;
    mutableAt: RunInventoryMutability;
    source: string;
    useRule: string;
}

export interface RunInventoryRow extends RunInventoryDefinition {
    quantity: number;
    quantityLabel: string;
    maxStack: number;
    remainingCapacity: number | null;
    atStackLimit: boolean;
    fullReason: string | null;
    slotId?: string;
    mutability?: RunInventoryMutability;
    useWindow?: string;
    effectPreview?: string;
    available: boolean;
    unavailableReason: string | null;
}

export interface RunLoadoutSlotRow {
    id: string;
    label: string;
    source: 'relic' | 'mutator' | 'contract';
    mutableDuringRun: boolean;
    changeWindow: string;
}

export interface RunInventorySnapshot {
    offlineOnly: true;
    consumables: RunInventoryRow[];
    loadout: RunLoadoutSlotRow[];
}

export const RUN_INVENTORY_CATALOG: Record<RunInventoryItemId, RunInventoryDefinition> = {
    shuffle_charge: {
        id: 'shuffle_charge',
        kind: 'consumable',
        label: 'Shuffle charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Run start, relics, and explicit reward pickups.',
        useRule: 'Spend during play to reshuffle hidden tiles; disabled by no-shuffle contracts.'
    },
    region_shuffle_charge: {
        id: 'region_shuffle_charge',
        kind: 'consumable',
        label: 'Row/swap charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Run start and relic services.',
        useRule: 'Spend during play to reshuffle one row or swap two hidden tiles; disabled by no-shuffle contracts.'
    },
    destroy_charge: {
        id: 'destroy_charge',
        kind: 'consumable',
        label: 'Destroy charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Relics, room rewards, shop services, events, and explicit pickups.',
        useRule: 'Spend during play to remove a hidden pair; disabled by no-destroy contracts.'
    },
    peek_charge: {
        id: 'peek_charge',
        kind: 'consumable',
        label: 'Peek charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Run start, relics, and shop services.',
        useRule: 'Spend during play to reveal tiles without committing flips.'
    },
    stray_remove_charge: {
        id: 'stray_remove_charge',
        kind: 'consumable',
        label: 'Stray remover',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Wild/practice setup and relics.',
        useRule: 'Spend during play to remove one hidden stray tile from the board.'
    },
    flash_pair_charge: {
        id: 'flash_pair_charge',
        kind: 'consumable',
        label: 'Flash pair',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Practice, Wild setup, and future recall pickups.',
        useRule: 'Spend during play to briefly reveal one random hidden pair.'
    },
    undo_charge: {
        id: 'undo_charge',
        kind: 'consumable',
        label: 'Undo charge',
        stackLimit: null,
        mutableAt: 'floor_only',
        source: 'Floor start and future recovery pickups.',
        useRule: 'Spend while resolving to cancel a pending flip result before it commits.'
    },
    gambit_token: {
        id: 'gambit_token',
        kind: 'consumable',
        label: 'Gambit token',
        stackLimit: 1,
        mutableAt: 'floor_only',
        source: 'Floor start and future risk pickups.',
        useRule: 'Spend the floor gambit window to attempt a third flip rescue.'
    },
    wild_match_token: {
        id: 'wild_match_token',
        kind: 'consumable',
        label: 'Wild match',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Wild/Joker setup and future rare pickups.',
        useRule: 'Spend by matching with a wild joker tile when one is present.'
    },
    iron_key: {
        id: 'iron_key',
        kind: 'consumable',
        label: 'Dungeon key',
        stackLimit: null,
        mutableAt: 'shop_or_rest',
        source: 'Key cards, locked caches, shops, events, and treasure rooms.',
        useRule: 'Spent from the run-only key ring on matching locked exits, cache doors, and treasure locks.'
    },
    master_key: {
        id: 'master_key',
        kind: 'consumable',
        label: 'Master key',
        stackLimit: null,
        mutableAt: 'shop_or_rest',
        source: 'Deep shops, boss prep shrines, and rare treasure rewards.',
        useRule: 'Spent once to open any locked dungeon exit, cache door, or treasure lock.'
    },
    guard_token: {
        id: 'guard_token',
        kind: 'consumable',
        label: 'Guard token',
        stackLimit: MAX_GUARD_TOKENS,
        mutableAt: 'floor_only',
        source: 'Streak rewards, lantern events, and guard relics.',
        useRule: 'Automatically absorbs mismatch life loss before hearts are spent.'
    },
    combo_shard: {
        id: 'combo_shard',
        kind: 'consumable',
        label: 'Combo shard',
        stackLimit: MAX_COMBO_SHARDS,
        mutableAt: 'floor_only',
        source: 'Match streaks and shard-spark pickups.',
        useRule: 'Automatically converts into life sustain when the shard threshold is met.'
    },
    relic_loadout: {
        id: 'relic_loadout',
        kind: 'loadout',
        label: 'Relic loadout',
        stackLimit: 12,
        mutableAt: 'draft_only',
        source: 'Milestone relic drafts and shrine services.',
        useRule: 'Changes only when a relic draft is open; selected relics are fixed for the run.'
    },
    mutator_loadout: {
        id: 'mutator_loadout',
        kind: 'loadout',
        label: 'Mutator loadout',
        stackLimit: null,
        mutableAt: 'locked',
        source: 'Mode selection, daily seed, or authored floor schedule.',
        useRule: 'Locked for the active floor; schedule may replace it on next floor.'
    },
    contract_loadout: {
        id: 'contract_loadout',
        kind: 'loadout',
        label: 'Contract loadout',
        stackLimit: null,
        mutableAt: 'locked',
        source: 'Mode/menu contract choice.',
        useRule: 'Locked after run start; no mid-run contract editing.'
    }
};

export const DUNGEON_KEY_SPEND_ORDER = ['iron', 'treasure', 'shrine', 'boss', 'trap'] as const satisfies readonly DungeonKeyKind[];

const nonNegativeQuantity = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const stringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const dungeonKeyRecord = (value: unknown): Partial<Record<DungeonKeyKind, number>> =>
    value != null && typeof value === 'object' ? value as Partial<Record<DungeonKeyKind, number>> : {};

export const getRunInventoryItemQuantity = (run: RunState, id: RunInventoryItemId): number => {
    const dungeonKeys = dungeonKeyRecord(run.dungeonKeys);
    const stats = normalizeSessionStats(run.stats);
    switch (id) {
        case 'shuffle_charge':
            return nonNegativeQuantity(run.shuffleCharges) + (run.freeShuffleThisFloor ? 1 : 0);
        case 'region_shuffle_charge':
            return nonNegativeQuantity(run.regionShuffleCharges) + (run.regionShuffleFreeThisFloor ? 1 : 0);
        case 'destroy_charge':
            return nonNegativeQuantity(run.destroyPairCharges);
        case 'peek_charge':
            return nonNegativeQuantity(run.peekCharges);
        case 'stray_remove_charge':
            return nonNegativeQuantity(run.strayRemoveCharges);
        case 'flash_pair_charge':
            return nonNegativeQuantity(run.flashPairCharges);
        case 'undo_charge':
            return nonNegativeQuantity(run.undoUsesThisFloor);
        case 'gambit_token':
            return run.gambitAvailableThisFloor && !run.gambitThirdFlipUsed ? 1 : 0;
        case 'wild_match_token':
            return nonNegativeQuantity(run.wildMatchesRemaining);
        case 'iron_key':
            return Object.values(dungeonKeys).reduce((sum, count) => sum + nonNegativeQuantity(count), 0);
        case 'master_key':
            return nonNegativeQuantity(run.dungeonMasterKeys);
        case 'guard_token':
            return nonNegativeQuantity(stats.guardTokens);
        case 'combo_shard':
            return nonNegativeQuantity(stats.comboShards);
        case 'relic_loadout':
            return stringArray(run.relicIds).length;
        case 'mutator_loadout':
            return stringArray(run.activeMutators).length;
        case 'contract_loadout':
            return run.activeContract ? 1 : 0;
        default:
            return 0;
    }
};

const unavailableReasonFor = (run: RunState, id: RunInventoryItemId, quantity: number): string | null => {
    if ((id === 'shuffle_charge' || id === 'region_shuffle_charge') && run.activeContract?.noShuffle) {
        return 'No-shuffle contract locks this consumable.';
    }
    if (id === 'destroy_charge' && run.activeContract?.noDestroy) {
        return 'No-destroy contract locks this consumable.';
    }
    if (quantity <= 0 && RUN_INVENTORY_CATALOG[id].kind === 'consumable') {
        return 'No charges currently banked.';
    }
    return null;
};

const quantityLabelFor = (definition: RunInventoryDefinition, quantity: number): string =>
    definition.stackLimit == null ? String(quantity) : `${quantity}/${definition.stackLimit}`;

const dungeonKeyQuantityLabelFor = (run: RunState, quantity: number): string => {
    const dungeonKeys = dungeonKeyRecord(run.dungeonKeys);
    const parts = DUNGEON_KEY_SPEND_ORDER
        .map((kind) => [kind, nonNegativeQuantity(dungeonKeys[kind])] as const)
        .filter(([, count]) => count > 0);
    if (parts.length === 0 || (parts.length === 1 && parts[0]?.[0] === 'iron')) {
        return String(quantity);
    }
    return `${quantity} (${parts.map(([kind, count]) => `${kind} ${count}`).join(', ')})`;
};

const maxStackFor = (definition: RunInventoryDefinition, quantity: number): number =>
    definition.stackLimit ?? Math.max(1, quantity);

const remainingCapacityFor = (definition: RunInventoryDefinition, quantity: number): number | null => {
    if (definition.kind !== 'consumable' || definition.stackLimit == null) {
        return null;
    }
    return Math.max(0, definition.stackLimit - quantity);
};

const fullReasonFor = (definition: RunInventoryDefinition, quantity: number): string | null => {
    const remainingCapacity = remainingCapacityFor(definition, quantity);
    if (remainingCapacity !== 0) {
        return null;
    }
    return `${definition.label} is at its run limit.`;
};

export const getRunInventoryRows = (run: RunState): RunInventoryRow[] =>
    RUN_INVENTORY_ITEM_IDS.map((id) => {
        const definition = RUN_INVENTORY_CATALOG[id];
        const quantity = getRunInventoryItemQuantity(run, id);
        const unavailableReason = unavailableReasonFor(run, id, quantity);
        const remainingCapacity = remainingCapacityFor(definition, quantity);
        return {
            ...definition,
            quantity,
            quantityLabel: id === 'iron_key' ? dungeonKeyQuantityLabelFor(run, quantity) : quantityLabelFor(definition, quantity),
            maxStack: maxStackFor(definition, quantity),
            remainingCapacity,
            atStackLimit: remainingCapacity === 0,
            fullReason: fullReasonFor(definition, quantity),
            slotId: id,
            mutability: definition.mutableAt,
            useWindow: definition.useRule,
            effectPreview: definition.kind === 'loadout' ? 'Locked run setup.' : definition.source,
            available: unavailableReason === null,
            unavailableReason
        };
    });

export const getRunConsumableRows = (run: RunState): RunInventoryRow[] =>
    getRunInventoryRows(run)
        .filter((row) => row.kind === 'consumable')
        .map((row) => ({ ...row }));

export const getRunLoadoutRows = (run: RunState): RunInventoryRow[] =>
    getRunInventoryRows(run).filter((row) => row.kind === 'loadout');

export const RUN_LOADOUT_SLOT_LIMIT = 4;

export const getRunInventoryLoadoutRows = (run: RunState): RunLoadoutSlotRow[] => [
    ...stringArray(run.relicIds).map((id) => ({
        id: `relic:${id}`,
        label: id.replace(/_/g, ' '),
        source: 'relic' as const,
        mutableDuringRun: false,
        changeWindow: 'Relic draft or relic service only.'
    })),
    ...stringArray(run.activeMutators).map((id) => ({
        id: `mutator:${id}`,
        label: id.replace(/_/g, ' '),
        source: 'mutator' as const,
        mutableDuringRun: false,
        changeWindow: 'Locked for the active floor; schedule may change next floor.'
    })),
    ...(run.activeContract
        ? [{
              id: 'contract:active',
              label: 'Scholar contract',
              source: 'contract' as const,
              mutableDuringRun: false,
              changeWindow: 'Locked at run start.'
          }]
        : [])
].slice(0, RUN_LOADOUT_SLOT_LIMIT);

export const buildRunInventory = (run: RunState): RunInventorySnapshot => ({
    offlineOnly: true,
    consumables: getRunConsumableRows(run)
        .filter((row) => row.id !== 'guard_token' && row.id !== 'combo_shard')
        .map((row) => ({ ...row })),
    loadout: getRunInventoryLoadoutRows(run)
});

export interface RunInventoryActionResult {
    run: RunState;
    itemId: RunInventoryItemId;
    applied: boolean;
    reason?: 'unavailable' | 'not_usable';
}

export interface RunInventoryGainPreview {
    itemId: RunInventoryItemId;
    requested: number;
    accepted: number;
    capped: boolean;
    quantity: number;
    nextQuantity: number;
    remainingCapacity: number | null;
}

export interface RunInventoryGainFeedback extends RunInventoryGainPreview {
    gainedLabel: string | null;
    cappedLabel: string | null;
    noPickupLabel: string | null;
}

const nonNegativeFiniteAmount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const previewRunInventoryItemGain = (
    run: RunState,
    itemId: RunInventoryItemId,
    amount: number = 1
): RunInventoryGainPreview => {
    const requested = nonNegativeFiniteAmount(amount);
    const definition = RUN_INVENTORY_CATALOG[itemId];
    const quantity = getRunInventoryItemQuantity(run, itemId);
    if (!definition) {
        return {
            itemId,
            requested,
            accepted: 0,
            capped: requested > 0,
            quantity,
            nextQuantity: quantity,
            remainingCapacity: null
        };
    }
    if (requested <= 0 || definition.kind !== 'consumable') {
        return {
            itemId,
            requested,
            accepted: 0,
            capped: requested > 0,
            quantity,
            nextQuantity: quantity,
            remainingCapacity: remainingCapacityFor(definition, quantity)
        };
    }

    const remainingCapacity = remainingCapacityFor(definition, quantity);
    const accepted = remainingCapacity == null ? requested : Math.min(requested, remainingCapacity);
    return {
        itemId,
        requested,
        accepted,
        capped: accepted < requested,
        quantity,
        nextQuantity: quantity + accepted,
        remainingCapacity: remainingCapacity == null ? null : Math.max(0, remainingCapacity - accepted)
    };
};

const PICKUP_GAIN_LABELS: Record<RunInventoryItemId, { singular: string; plural: string }> = {
    shuffle_charge: { singular: 'shuffle charge', plural: 'shuffle charges' },
    region_shuffle_charge: { singular: 'row/swap charge', plural: 'row/swap charges' },
    destroy_charge: { singular: 'destroy charge', plural: 'destroy charges' },
    peek_charge: { singular: 'peek charge', plural: 'peek charges' },
    stray_remove_charge: { singular: 'stray remover', plural: 'stray removers' },
    flash_pair_charge: { singular: 'flash pair', plural: 'flash pairs' },
    undo_charge: { singular: 'undo charge', plural: 'undo charges' },
    gambit_token: { singular: 'Gambit token', plural: 'Gambit tokens' },
    wild_match_token: { singular: 'wild match', plural: 'wild matches' },
    iron_key: { singular: 'dungeon key', plural: 'dungeon keys' },
    master_key: { singular: 'master key', plural: 'master keys' },
    guard_token: { singular: 'guard token', plural: 'guard tokens' },
    combo_shard: { singular: 'combo shard', plural: 'combo shards' },
    relic_loadout: { singular: 'relic loadout', plural: 'relic loadouts' },
    mutator_loadout: { singular: 'mutator loadout', plural: 'mutator loadouts' },
    contract_loadout: { singular: 'contract loadout', plural: 'contract loadouts' }
};

const inventoryGainLabelFor = (itemId: RunInventoryItemId, amount: number): string => {
    const labels = PICKUP_GAIN_LABELS[itemId];
    return amount === 1 ? labels.singular : labels.plural;
};

const CAPPED_GAIN_LABELS: Partial<Record<RunInventoryItemId, string>> = {
    peek_charge: 'Peek charges already full',
    guard_token: 'Guard tokens already full',
    combo_shard: 'Combo shards already full',
    iron_key: 'Dungeon keys already full',
    master_key: 'Master keys already full'
};

const cappedFeedbackLabelFor = (itemId: RunInventoryItemId): string => {
    const definition = RUN_INVENTORY_CATALOG[itemId];
    return CAPPED_GAIN_LABELS[itemId] ?? (definition.stackLimit == null
        ? `${definition.label}s cannot take this pickup`
        : `${definition.label} already full`);
};

export const getRunInventoryGainFeedback = (
    run: RunState,
    itemId: RunInventoryItemId,
    amount: number = 1
): RunInventoryGainFeedback => {
    const preview = previewRunInventoryItemGain(run, itemId, amount);
    const definition = RUN_INVENTORY_CATALOG[itemId];
    if (!definition) {
        return {
            ...preview,
            gainedLabel: null,
            cappedLabel: preview.capped ? 'Inventory pickup unavailable' : null,
            noPickupLabel: 'No inventory pickup available'
        };
    }
    if (definition.kind !== 'consumable' || preview.requested <= 0) {
        return {
            ...preview,
            gainedLabel: null,
            cappedLabel: null,
            noPickupLabel: 'No inventory pickup available'
        };
    }

    const gainedLabel =
        preview.accepted > 0
            ? `+${preview.accepted} ${inventoryGainLabelFor(itemId, preview.accepted)}`
            : null;
    const cappedLabel = preview.capped ? cappedFeedbackLabelFor(itemId) : null;
    return {
        ...preview,
        gainedLabel,
        cappedLabel,
        noPickupLabel: gainedLabel || cappedLabel ? null : 'No inventory pickup available'
    };
};

export const gainRunInventoryItem = (
    run: RunState,
    itemId: RunInventoryItemId,
    amount: number = 1
): RunState => {
    const gain = previewRunInventoryItemGain(run, itemId, amount).accepted;
    if (gain <= 0) {
        return run;
    }
    switch (itemId) {
        case 'shuffle_charge':
            return { ...run, shuffleCharges: nonNegativeQuantity(run.shuffleCharges) + gain };
        case 'region_shuffle_charge':
            return { ...run, regionShuffleCharges: nonNegativeQuantity(run.regionShuffleCharges) + gain };
        case 'destroy_charge':
            return { ...run, destroyPairCharges: nonNegativeQuantity(run.destroyPairCharges) + gain };
        case 'peek_charge':
            return { ...run, peekCharges: nonNegativeQuantity(run.peekCharges) + gain };
        case 'stray_remove_charge':
            return { ...run, strayRemoveCharges: nonNegativeQuantity(run.strayRemoveCharges) + gain };
        case 'flash_pair_charge':
            return { ...run, flashPairCharges: nonNegativeQuantity(run.flashPairCharges) + gain };
        case 'undo_charge':
            return { ...run, undoUsesThisFloor: nonNegativeQuantity(run.undoUsesThisFloor) + gain };
        case 'gambit_token':
            return { ...run, gambitAvailableThisFloor: true, gambitThirdFlipUsed: false };
        case 'wild_match_token':
            return { ...run, wildMatchesRemaining: nonNegativeQuantity(run.wildMatchesRemaining) + gain };
        case 'iron_key':
            return { ...run, dungeonKeys: { ...dungeonKeyRecord(run.dungeonKeys), iron: nonNegativeQuantity(dungeonKeyRecord(run.dungeonKeys).iron) + gain } };
        case 'master_key':
            return { ...run, dungeonMasterKeys: nonNegativeQuantity(run.dungeonMasterKeys) + gain };
        case 'guard_token':
            {
                const stats = normalizeSessionStats(run.stats);
                return {
                    ...run,
                    stats: { ...stats, guardTokens: Math.min(MAX_GUARD_TOKENS, nonNegativeQuantity(stats.guardTokens) + gain) }
                };
            }
        case 'combo_shard':
            {
                const stats = normalizeSessionStats(run.stats);
                return {
                    ...run,
                    stats: { ...stats, comboShards: Math.min(MAX_COMBO_SHARDS, nonNegativeQuantity(stats.comboShards) + gain) }
                };
            }
        default:
            return run;
    }
};

export const useRunInventoryItem = (run: RunState, itemId: RunInventoryItemId): RunInventoryActionResult => {
    const row = getRunInventoryRows(run).find((item) => item.id === itemId);
    if (!row || !row.available) {
        return { run, itemId, applied: false, reason: 'unavailable' };
    }
    switch (itemId) {
        case 'shuffle_charge':
            return run.freeShuffleThisFloor
                ? { run: { ...run, freeShuffleThisFloor: false }, itemId, applied: true }
                : { run: { ...run, shuffleCharges: Math.max(0, nonNegativeQuantity(run.shuffleCharges) - 1) }, itemId, applied: true };
        case 'region_shuffle_charge':
            return run.regionShuffleFreeThisFloor
                ? { run: { ...run, regionShuffleFreeThisFloor: false }, itemId, applied: true }
                : { run: { ...run, regionShuffleCharges: Math.max(0, nonNegativeQuantity(run.regionShuffleCharges) - 1) }, itemId, applied: true };
        case 'destroy_charge':
            return { run: { ...run, destroyPairCharges: Math.max(0, nonNegativeQuantity(run.destroyPairCharges) - 1) }, itemId, applied: true };
        case 'peek_charge':
            return { run: { ...run, peekCharges: Math.max(0, nonNegativeQuantity(run.peekCharges) - 1) }, itemId, applied: true };
        case 'stray_remove_charge':
            return { run: { ...run, strayRemoveCharges: Math.max(0, nonNegativeQuantity(run.strayRemoveCharges) - 1) }, itemId, applied: true };
        case 'flash_pair_charge':
            return { run: { ...run, flashPairCharges: Math.max(0, nonNegativeQuantity(run.flashPairCharges) - 1) }, itemId, applied: true };
        case 'undo_charge':
            return { run: { ...run, undoUsesThisFloor: Math.max(0, nonNegativeQuantity(run.undoUsesThisFloor) - 1) }, itemId, applied: true };
        case 'gambit_token':
            return { run: { ...run, gambitAvailableThisFloor: false, gambitThirdFlipUsed: true }, itemId, applied: true };
        case 'wild_match_token':
            return { run: { ...run, wildMatchesRemaining: Math.max(0, nonNegativeQuantity(run.wildMatchesRemaining) - 1) }, itemId, applied: true };
        case 'iron_key': {
            const dungeonKeys = dungeonKeyRecord(run.dungeonKeys);
            const spendKind = DUNGEON_KEY_SPEND_ORDER.find((kind) => nonNegativeQuantity(dungeonKeys[kind] ?? 0) > 0);
            if (!spendKind) {
                return { run, itemId, applied: false, reason: 'unavailable' };
            }
            return {
                run: {
                    ...run,
                    dungeonKeys: { ...dungeonKeys, [spendKind]: Math.max(0, nonNegativeQuantity(dungeonKeys[spendKind] ?? 0) - 1) }
                },
                itemId,
                applied: true
            };
        }
        case 'master_key':
            return { run: { ...run, dungeonMasterKeys: Math.max(0, nonNegativeQuantity(run.dungeonMasterKeys) - 1) }, itemId, applied: true };
        default:
            return { run, itemId, applied: false, reason: 'not_usable' };
    }
};

export const getRunLoadoutSummary = (run: RunState): {
    equipped: number;
    capacity: number;
    totalStacks: number;
    midRunMutable: boolean;
} => {
    const inventory = buildRunInventory(run);
    return {
        equipped: inventory.loadout.length,
        capacity: RUN_LOADOUT_SLOT_LIMIT,
        totalStacks: inventory.consumables.reduce((sum, row) => sum + row.quantity, 0),
        midRunMutable: inventory.consumables.some((row) => row.mutableAt === 'mid_run' && row.quantity > 0)
    };
};
