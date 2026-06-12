import {
    FLOOR_CLEAR_GOLD_BASE,
    MAX_LIVES,
    type RouteNodeType,
    type RunShopItemId,
    type RunShopOfferState,
    type RunState
} from './contracts';
import { gainRunInventoryItem } from './run-inventory';

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

export const getRunShopStockPlan = (run: RunState): RunShopStockPlan => {
    const level = run.board?.level ?? run.stats.highestLevel;
    const source: RunShopSource = run.board?.dungeonShopTileId ? 'board_shop' : 'floor_clear_shop';
    const routeType = run.board?.routeWorldProfile?.routeType ?? run.pendingRouteCardPlan?.routeType ?? null;
    const itemIds: RunShopItemId[] = ['heal_life', 'peek_charge', 'destroy_charge', 'iron_key'];
    if (level >= 5 || source === 'board_shop') {
        itemIds.push('master_key');
    }
    const previewCopy =
        source === 'board_shop'
            ? `Board vendor: ${itemIds.length} deterministic services, reroll ${getShopRerollCostForFloor(level)} shop gold.`
            : `Floor-clear vendor: ${itemIds.length} deterministic services, reroll ${getShopRerollCostForFloor(level)} shop gold.`;
    return {
        source,
        level,
        routeType,
        itemIds,
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
    return { compatible: true, unavailableReason: null };
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
        case 'destroy_charge':
            next = gainRunInventoryItem(next, 'destroy_charge');
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
