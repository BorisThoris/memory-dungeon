import {
    FLOOR_CLEAR_GOLD_BASE,
    MAX_LIVES,
    type BoardState,
    type RouteNodeType,
    type RunShopItemId,
    type RunShopOfferState,
    type RunState,
    type Tile,
    type TileTraitKind
} from './contracts';
import { getActiveDungeonBossPressureRule } from './dungeon-boss-rules';
import { gainRunInventoryItem } from './run-inventory';
import { getTileTraitInteractionPreviewLines } from './tile-trait-rules';

export const SHOP_ITEM_CATALOG: Record<
    RunShopItemId,
    Omit<RunShopOfferState, 'id' | 'purchased' | 'compatible' | 'unavailableReason'>
> = {
    heal_life: {
        itemId: 'heal_life',
        label: 'Mend a life',
        description: 'Restore 1 life now, capped by max lives.',
        category: 'consumable',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: MAX_LIVES
    },
    peek_charge: {
        itemId: 'peek_charge',
        label: 'Peek charge',
        description: 'Add 1 peek charge for this run.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    region_shuffle_charge: {
        itemId: 'region_shuffle_charge',
        label: 'Row/swap charge',
        description: 'Add 1 row shuffle or tile swap charge for trait routing.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    destroy_charge: {
        itemId: 'destroy_charge',
        label: 'Destroy charge',
        description: 'Add 1 destroy charge to the uncapped run bank.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 3,
        cost: 3,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    trait_cleanse: {
        itemId: 'trait_cleanse',
        label: 'Trait cleanse',
        description: 'Immediately softens one hidden Cursed or Volatile trait pair into a safer routing trait.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    trait_routing_kit: {
        itemId: 'trait_routing_kit',
        label: 'Trait routing kit',
        description: 'Adds 1 peek charge and 1 row/swap charge when this floor has actionable trait adjacency.',
        category: 'service',
        compatibleWhen: 'owned',
        baseCost: 3,
        cost: 3,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    iron_key: {
        itemId: 'iron_key',
        label: 'Iron key',
        description: 'Adds one run-local key for locked exit doors and caches.',
        category: 'consumable',
        compatibleWhen: 'owned',
        baseCost: 2,
        cost: 2,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    },
    master_key: {
        itemId: 'master_key',
        label: 'Master key',
        description: 'Opens any one locked exit door or cache in this run.',
        category: 'consumable',
        compatibleWhen: 'owned',
        baseCost: 5,
        cost: 5,
        stock: 1,
        maxStock: 1,
        stackLimit: null
    }
};

export const getShopGoldRewardForFloor = (level: number): number =>
    Math.min(8, FLOOR_CLEAR_GOLD_BASE + Math.max(0, Math.floor(level) - 1));

export const getShopRerollCostForFloor = (level: number): number =>
    1 + Math.floor(Math.max(0, Math.floor(level) - 1) / 3);

export type RunShopSource = 'floor_clear_shop' | 'board_shop';

export interface RunShopStockPlan {
    source: RunShopSource;
    level: number;
    routeType: RouteNodeType | null;
    itemIds: RunShopItemId[];
    rerollCost: number;
    previewCopy: string;
}

export interface RunShopReadModel {
    source: RunShopSource;
    level: number;
    routeType: RouteNodeType | null;
    offerCount: number;
    availableOfferCount: number;
    purchasedOfferCount: number;
    wallet: number;
    rerollCost: number;
    canReroll: boolean;
    previewCopy: string;
}

const uniqueItemIds = (itemIds: readonly RunShopItemId[]): RunShopItemId[] => [...new Set(itemIds)];

const boardHasLockedExitPressure = (board: BoardState | null): boolean =>
    board?.dungeonExitLockKind != null && board.dungeonExitLockKind !== 'none' && board.dungeonExitLockKind !== 'lever';

const boardHasDangerousTraitPair = (board: BoardState | null): boolean =>
    (board?.tiles ?? []).some((tile) =>
        tile.state === 'hidden' && (tile.tileTraitKind === 'cursed' || tile.tileTraitKind === 'volatile')
    );

const boardHasTraitComboOpportunity = (board: BoardState | null): boolean => {
    if (!board) {
        return false;
    }
    return board.tiles.some((tile) => {
        if (!tile.tileTraitKind) {
            return false;
        }
        return (
            getTileTraitInteractionPreviewLines(board, [tile.id], 'match').length > 0 ||
            getTileTraitInteractionPreviewLines(board, [tile.id], 'mismatch').length > 0
        );
    });
};

const routeStockTemplate = (
    routeType: RouteNodeType | null,
    source: RunShopSource,
    rerollRound: number
): RunShopItemId[] => {
    const baseline: RunShopItemId[] =
        routeType === 'safe'
            ? ['heal_life', 'peek_charge', 'iron_key', 'region_shuffle_charge', 'trait_cleanse', 'destroy_charge']
            : routeType === 'greed'
              ? ['iron_key', 'region_shuffle_charge', 'destroy_charge', 'trait_cleanse', 'peek_charge']
              : routeType === 'mystery'
                ? ['peek_charge', 'trait_cleanse', 'region_shuffle_charge', 'iron_key', 'destroy_charge']
                : ['heal_life', 'peek_charge', 'region_shuffle_charge', 'destroy_charge', 'iron_key'];
    if (rerollRound <= 0) {
        return baseline;
    }
    const alternate: RunShopItemId[] =
        routeType === 'safe'
            ? ['peek_charge', 'trait_cleanse', 'heal_life', 'iron_key', 'region_shuffle_charge', 'destroy_charge']
            : routeType === 'greed'
              ? ['destroy_charge', 'iron_key', 'master_key', 'region_shuffle_charge', 'trait_cleanse']
              : routeType === 'mystery'
                ? ['trait_cleanse', 'peek_charge', 'destroy_charge', 'region_shuffle_charge', 'iron_key']
                : ['trait_cleanse', 'iron_key', 'peek_charge', 'region_shuffle_charge', 'destroy_charge'];
    return source === 'board_shop' ? uniqueItemIds(['master_key', ...alternate]) : alternate;
};

const loadoutStockBias = (run: RunState): RunShopItemId[] => {
    switch (run.startingLoadoutId) {
        case 'memory_scout':
            return ['peek_charge'];
        case 'route_tactician':
            return ['region_shuffle_charge'];
        case 'cursebreaker':
            return ['destroy_charge', 'trait_cleanse'];
        case 'vaultbreaker':
            return ['iron_key'];
        default:
            return [];
    }
};

export const getRunShopStockPlan = (run: RunState): RunShopStockPlan => {
    const level = run.board?.level ?? run.stats.highestLevel;
    const source: RunShopSource = run.board?.dungeonShopTileId ? 'board_shop' : 'floor_clear_shop';
    const routeType = run.board?.routeWorldProfile?.routeType ?? run.pendingRouteCardPlan?.routeType ?? null;
    const itemIds: RunShopItemId[] = routeStockTemplate(routeType, source, run.shopRerolls);
    itemIds.unshift(...loadoutStockBias(run));
    const bossPressure = run.board?.floorTag === 'boss' ? getActiveDungeonBossPressureRule(run.board) : null;
    if (bossPressure) {
        itemIds.unshift(bossPressure.shopPriorityItemId);
    }
    if (boardHasLockedExitPressure(run.board)) {
        itemIds.unshift('iron_key');
    }
    const needsMasterKey = level >= 5 || source === 'board_shop';
    if (needsMasterKey) {
        itemIds.push('master_key');
    }
    if (boardHasDangerousTraitPair(run.board)) {
        itemIds.unshift('trait_cleanse');
    }
    if (boardHasTraitComboOpportunity(run.board)) {
        itemIds.unshift('trait_routing_kit');
    }
    const stockLimit = source === 'board_shop' || itemIds.includes('trait_cleanse') ? 6 : 5;
    const uniqueStock = uniqueItemIds(itemIds);
    const finalItemIds: RunShopItemId[] =
        needsMasterKey && uniqueStock.indexOf('master_key') >= stockLimit
            ? [...uniqueStock.filter((itemId) => itemId !== 'master_key').slice(0, stockLimit - 1), 'master_key']
            : uniqueStock.slice(0, stockLimit);
    const previewCopy =
        source === 'board_shop'
            ? `Board vendor: ${finalItemIds.length} deterministic route-aware services, reroll ${getShopRerollCostForFloor(level)} shop gold.`
            : `Floor-clear vendor: ${finalItemIds.length} deterministic route-aware services, reroll ${getShopRerollCostForFloor(level)} shop gold.`;
    return {
        source,
        level,
        routeType,
        itemIds: finalItemIds,
        rerollCost: getShopRerollCostForFloor(level),
        previewCopy
    };
};

export const getShopWalletPacing = (run: RunState): {
    earnedThisFloor: number;
    totalWallet: number;
    sinkCostTotal: number;
    conversionAtRunEnd: 'unspent_shop_gold_expires';
} => {
    const level = run.board?.level ?? run.stats.highestLevel;
    return {
        earnedThisFloor: getShopGoldRewardForFloor(level),
        totalWallet: run.shopGold,
        sinkCostTotal: run.shopOffers.reduce((sum, offer) => sum + offer.cost, 0),
        conversionAtRunEnd: 'unspent_shop_gold_expires'
    };
};

export const getRunShopWalletPacing = (run: RunState): {
    earnedThisFloor: number;
    totalWallet: number;
    sinkCostTotal: number;
    conversionAtRunEnd: 'unspent_shop_gold_expires';
} => ({
    earnedThisFloor: getShopGoldRewardForFloor(run.board?.level ?? run.stats.highestLevel),
    totalWallet: run.shopGold,
    sinkCostTotal: run.shopOffers.reduce((sum, offer) => sum + offer.cost, 0),
    conversionAtRunEnd: 'unspent_shop_gold_expires'
});

const getShopOfferCompatibility = (
    run: RunState,
    itemId: RunShopItemId
): Pick<RunShopOfferState, 'compatible' | 'unavailableReason'> => {
    if (itemId === 'heal_life' && run.lives >= MAX_LIVES) {
        return { compatible: false, unavailableReason: 'Life already full.' };
    }
    if (itemId === 'destroy_charge' && run.activeContract?.noDestroy) {
        return { compatible: false, unavailableReason: 'No-destroy contract locks this item.' };
    }
    if (itemId === 'region_shuffle_charge' && run.activeContract?.noShuffle) {
        return { compatible: false, unavailableReason: 'No-shuffle contract locks this item.' };
    }
    if (itemId === 'trait_cleanse' && !boardHasDangerousTraitPair(run.board)) {
        return { compatible: false, unavailableReason: 'No Cursed or Volatile hidden trait pair to cleanse.' };
    }
    if (itemId === 'trait_routing_kit' && !boardHasTraitComboOpportunity(run.board)) {
        return { compatible: false, unavailableReason: 'No actionable trait adjacency to route around.' };
    }
    return { compatible: true, unavailableReason: null };
};

const CLEANSE_TRAIT_REPLACEMENTS: Record<Extract<TileTraitKind, 'cursed' | 'volatile'>, TileTraitKind> = {
    cursed: 'stasis',
    volatile: 'echo'
};

const cleanseDangerousTraitPair = (board: BoardState | null): BoardState | null => {
    if (!board) {
        return board;
    }
    const target = board.tiles.find((tile) =>
        tile.state === 'hidden' && (tile.tileTraitKind === 'cursed' || tile.tileTraitKind === 'volatile')
    );
    if (!target || target.tileTraitKind !== 'cursed' && target.tileTraitKind !== 'volatile') {
        return board;
    }
    const nextTrait = CLEANSE_TRAIT_REPLACEMENTS[target.tileTraitKind];
    const tiles: Tile[] = board.tiles.map((tile) =>
        tile.pairKey === target.pairKey && tile.tileTraitKind === target.tileTraitKind
            ? { ...tile, tileTraitKind: nextTrait }
            : tile
    );
    return { ...board, tiles };
};

export const createRunShopOffers = (run: RunState): RunShopOfferState[] => {
    const plan = getRunShopStockPlan(run);
    return plan.itemIds.map((itemId, index) => {
        const base = SHOP_ITEM_CATALOG[itemId];
        return {
            ...base,
            ...getShopOfferCompatibility(run, itemId),
            id: `${run.runRulesVersion}:${run.runSeed}:${plan.level}:shop:${run.shopRerolls}:${index}`,
            purchased: false
        };
    });
};

export const canRerollShopOffers = (run: RunState): boolean =>
    run.shopOffers.length > 0 &&
    run.shopRerolls < 1 &&
    run.shopGold >= getShopRerollCostForFloor(run.board?.level ?? run.stats.highestLevel);

export const getRunShopReadModel = (run: RunState): RunShopReadModel => {
    const plan = getRunShopStockPlan(run);
    const availableOfferCount = run.shopOffers.filter((offer) => {
        const currentCompatibility = getShopOfferCompatibility(run, offer.itemId);
        return !offer.purchased && currentCompatibility.compatible && run.shopGold >= offer.cost;
    }).length;
    return {
        source: plan.source,
        level: plan.level,
        routeType: plan.routeType,
        offerCount: run.shopOffers.length,
        availableOfferCount,
        purchasedOfferCount: run.shopOffers.filter((offer) => offer.purchased).length,
        wallet: run.shopGold,
        rerollCost: plan.rerollCost,
        canReroll: canRerollShopOffers(run),
        previewCopy: plan.previewCopy
    };
};

export const rerollShopOffers = (run: RunState): RunState => {
    if (!canRerollShopOffers(run)) {
        return run;
    }
    const cost = getShopRerollCostForFloor(run.board?.level ?? run.stats.highestLevel);
    const nextRun = { ...run, shopGold: run.shopGold - cost, shopRerolls: run.shopRerolls + 1 };
    return { ...nextRun, shopOffers: createRunShopOffers(nextRun) };
};

export const purchaseShopOffer = (run: RunState, offerId: string): RunState => {
    const offer = run.shopOffers.find((item) => item.id === offerId);
    if (!offer || offer.purchased || run.shopGold < offer.cost) {
        return run;
    }

    const currentCompatibility = getShopOfferCompatibility(run, offer.itemId);
    if (!offer.compatible || !currentCompatibility.compatible) {
        return run;
    }

    let next: RunState = {
        ...run,
        shopGold: run.shopGold - offer.cost,
        shopOffers: run.shopOffers.map((item) => (item.id === offerId ? { ...item, purchased: true } : item))
    };

    switch (offer.itemId) {
        case 'heal_life':
            next = { ...next, lives: Math.min(MAX_LIVES, next.lives + 1) };
            break;
        case 'peek_charge':
            next = gainRunInventoryItem(next, 'peek_charge');
            break;
        case 'region_shuffle_charge':
            next = gainRunInventoryItem(next, 'region_shuffle_charge');
            break;
        case 'destroy_charge':
            next = gainRunInventoryItem(next, 'destroy_charge');
            break;
        case 'trait_cleanse':
            next = { ...next, board: cleanseDangerousTraitPair(next.board) };
            break;
        case 'trait_routing_kit':
            next = gainRunInventoryItem(gainRunInventoryItem(next, 'peek_charge'), 'region_shuffle_charge');
            break;
        case 'iron_key':
            next = gainRunInventoryItem(next, 'iron_key');
            break;
        case 'master_key':
            next = gainRunInventoryItem(next, 'master_key');
            break;
        default:
            break;
    }

    return next;
};
