import { type MutatorId, type RunState } from './contracts';
import { runArray } from './run-array-guards';
import { runRecord } from './run-record-guards';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import { RUN_INVENTORY_ITEM_IDS, type RunInventoryItemId } from './run-inventory-contracts';

export { RUN_INVENTORY_ITEM_IDS, type RunInventoryItemId } from './run-inventory-contracts';

export type RunInventoryItemKind = 'consumable' | 'loadout';
export type RunInventoryMutability = 'mid_run' | 'floor_only' | 'locked';

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
    source: 'mutator' | 'contract';
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
        source: 'Run start and explicit reward pickups.',
        useRule: 'Spend during play to reshuffle hidden tiles; disabled by no-shuffle contracts.'
    },
    region_shuffle_charge: {
        id: 'region_shuffle_charge',
        kind: 'consumable',
        label: 'Row/swap charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Run start.',
        useRule: 'Spend during play to reshuffle one row or swap two hidden tiles; disabled by no-shuffle contracts.'
    },
    destroy_charge: {
        id: 'destroy_charge',
        kind: 'consumable',
        label: 'Destroy charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Run start and explicit pickups.',
        useRule: 'Spend during play to remove a hidden pair; disabled by no-destroy contracts.'
    },
    peek_charge: {
        id: 'peek_charge',
        kind: 'consumable',
        label: 'Peek charge',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Run start, Echo trait matches, Conduit beside Echo, and explicit pickups.',
        useRule: 'Spend during play to reveal tiles without committing flips.'
    },
    stray_remove_charge: {
        id: 'stray_remove_charge',
        kind: 'consumable',
        label: 'Stray remover',
        stackLimit: null,
        mutableAt: 'mid_run',
        source: 'Wild/practice setup.',
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

export interface RunInventoryItemPayoutRow {
    id: RunInventoryItemId;
    amount: number;
}

export const getRunInventoryItemPayoutRows = (value: unknown): RunInventoryItemPayoutRow[] => {
    const payouts = runRecord(value);
    return RUN_INVENTORY_ITEM_IDS.map((id) => ({
        id,
        amount: runNonNegativeInteger(payouts[id])
    }));
};

export const getRunInventoryItemQuantity = (run: RunState, id: RunInventoryItemId): number => {
    switch (id) {
        case 'shuffle_charge':
            return runNonNegativeInteger(run.shuffleCharges);
        case 'region_shuffle_charge':
            return runNonNegativeInteger(run.regionShuffleCharges);
        case 'destroy_charge':
            return runNonNegativeInteger(run.destroyPairCharges);
        case 'peek_charge':
            return runNonNegativeInteger(run.peekCharges);
        case 'stray_remove_charge':
            return runNonNegativeInteger(run.strayRemoveCharges);
        case 'flash_pair_charge':
            return runNonNegativeInteger(run.flashPairCharges);
        case 'undo_charge':
            return runNonNegativeInteger(run.undoUsesThisFloor);
        case 'gambit_token':
            return run.gambitAvailableThisFloor && !run.gambitThirdFlipUsed ? 1 : 0;
        case 'wild_match_token':
            return runNonNegativeInteger(run.wildMatchesRemaining);
        case 'mutator_loadout':
            return runArray<MutatorId>(run.activeMutators).length;
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
            quantityLabel: quantityLabelFor(definition, quantity),
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
    ...runArray<MutatorId>(run.activeMutators).map((id) => ({
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
    consumables: getRunConsumableRows(run).map((row) => ({ ...row })),
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

export const previewRunInventoryItemGain = (
    run: RunState,
    itemId: RunInventoryItemId,
    amount: number = 1
): RunInventoryGainPreview => {
    const requested = runNonNegativeInteger(amount);
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
    mutator_loadout: { singular: 'mutator loadout', plural: 'mutator loadouts' },
    contract_loadout: { singular: 'contract loadout', plural: 'contract loadouts' }
};

const inventoryGainLabelFor = (itemId: RunInventoryItemId, amount: number): string => {
    const labels = PICKUP_GAIN_LABELS[itemId];
    return amount === 1 ? labels.singular : labels.plural;
};

const CAPPED_GAIN_LABELS: Partial<Record<RunInventoryItemId, string>> = {
    peek_charge: 'Peek charges already full'
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
            return { ...run, shuffleCharges: runNonNegativeInteger(run.shuffleCharges) + gain };
        case 'region_shuffle_charge':
            return { ...run, regionShuffleCharges: runNonNegativeInteger(run.regionShuffleCharges) + gain };
        case 'destroy_charge':
            return { ...run, destroyPairCharges: runNonNegativeInteger(run.destroyPairCharges) + gain };
        case 'peek_charge':
            return { ...run, peekCharges: runNonNegativeInteger(run.peekCharges) + gain };
        case 'stray_remove_charge':
            return { ...run, strayRemoveCharges: runNonNegativeInteger(run.strayRemoveCharges) + gain };
        case 'flash_pair_charge':
            return { ...run, flashPairCharges: runNonNegativeInteger(run.flashPairCharges) + gain };
        case 'undo_charge':
            return { ...run, undoUsesThisFloor: runNonNegativeInteger(run.undoUsesThisFloor) + gain };
        case 'gambit_token':
            return { ...run, gambitAvailableThisFloor: true, gambitThirdFlipUsed: false };
        case 'wild_match_token':
            return { ...run, wildMatchesRemaining: runNonNegativeInteger(run.wildMatchesRemaining) + gain };
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
            return { run: { ...run, shuffleCharges: decrementRunCounter(run.shuffleCharges) }, itemId, applied: true };
        case 'region_shuffle_charge':
            return { run: { ...run, regionShuffleCharges: decrementRunCounter(run.regionShuffleCharges) }, itemId, applied: true };
        case 'destroy_charge':
            return { run: { ...run, destroyPairCharges: decrementRunCounter(run.destroyPairCharges) }, itemId, applied: true };
        case 'peek_charge':
            return { run: { ...run, peekCharges: decrementRunCounter(run.peekCharges) }, itemId, applied: true };
        case 'stray_remove_charge':
            return { run: { ...run, strayRemoveCharges: decrementRunCounter(run.strayRemoveCharges) }, itemId, applied: true };
        case 'flash_pair_charge':
            return { run: { ...run, flashPairCharges: decrementRunCounter(run.flashPairCharges) }, itemId, applied: true };
        case 'undo_charge':
            return { run: { ...run, undoUsesThisFloor: decrementRunCounter(run.undoUsesThisFloor) }, itemId, applied: true };
        case 'gambit_token':
            return { run: { ...run, gambitAvailableThisFloor: false, gambitThirdFlipUsed: true }, itemId, applied: true };
        case 'wild_match_token':
            return { run: { ...run, wildMatchesRemaining: decrementRunCounter(run.wildMatchesRemaining) }, itemId, applied: true };
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
