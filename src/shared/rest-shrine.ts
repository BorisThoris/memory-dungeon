import { MAX_GUARD_TOKENS, MAX_LIVES, type RunState } from './contracts';
import { normalizeSessionStats } from './session-stats-rules';

export type RestShrineServiceId = 'rest_heal' | 'guard_focus' | 'shrine_bargain' | 'boss_ward';
export type RestShrineRisk = 'safe' | 'risk';

export interface RestShrineServiceDefinition {
    serviceId: RestShrineServiceId;
    label: string;
    description: string;
    cost: number;
    risk: RestShrineRisk;
    rewardText: string;
}

export interface RestShrineServiceState extends RestShrineServiceDefinition {
    id: string;
    available: boolean;
    unavailableReason: string | null;
    purchased: boolean;
}

export interface RestShrineReadModel {
    serviceCount: number;
    availableCount: number;
    affordableCount: number;
    purchasedCount: number;
    previewCopy: string;
}

export const REST_SHRINE_SERVICE_CATALOG: Record<RestShrineServiceId, RestShrineServiceDefinition> = {
    rest_heal: {
        serviceId: 'rest_heal',
        label: 'Rest heal',
        description: 'Spend shop gold to restore 1 life, capped by max lives.',
        cost: 2,
        risk: 'safe',
        rewardText: '+1 life'
    },
    guard_focus: {
        serviceId: 'guard_focus',
        label: 'Guard focus',
        description: 'Spend shop gold to gain 1 guard token, capped by the guard bank.',
        cost: 1,
        risk: 'safe',
        rewardText: '+1 guard'
    },
    shrine_bargain: {
        serviceId: 'shrine_bargain',
        label: 'Shrine bargain',
        description: 'Spend shop gold for +1 relic Favor progress.',
        cost: 3,
        risk: 'risk',
        rewardText: '+1 Favor progress'
    },
    boss_ward: {
        serviceId: 'boss_ward',
        label: 'Boss ward',
        description: 'Spend shop gold to prepare one master key for a future lock or cache.',
        cost: 4,
        risk: 'safe',
        rewardText: '+1 master key'
    }
};

const nonNegativeRestShrineCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const createRestShrineServices = (run: RunState): RestShrineServiceState[] =>
    (Object.keys(REST_SHRINE_SERVICE_CATALOG) as RestShrineServiceId[]).map((serviceId, index) => {
        const base = REST_SHRINE_SERVICE_CATALOG[serviceId];
        const stats = normalizeSessionStats(run.stats);
        const unavailableReason =
            serviceId === 'rest_heal' && nonNegativeRestShrineCount(run.lives) >= MAX_LIVES
                ? 'Life already full.'
                : serviceId === 'guard_focus' && stats.guardTokens >= MAX_GUARD_TOKENS
                  ? 'Guard bank full.'
                  : serviceId === 'boss_ward' && nonNegativeRestShrineCount(run.dungeonMasterKeys) > 0
                    ? 'Master key already held.'
                    : null;
        const available = unavailableReason == null;
        return {
            ...base,
            id: `${run.runRulesVersion}:${run.runSeed}:${run.board?.level ?? stats.highestLevel}:rest:${index}`,
            available,
            unavailableReason,
            purchased: false
        };
    });

export const restShrineServiceCanAfford = (run: RunState, service: RestShrineServiceState): boolean =>
    service.available && nonNegativeRestShrineCount(run.shopGold) >= service.cost;

export const getRestShrineReadModel = (
    run: RunState,
    services: readonly RestShrineServiceState[] = createRestShrineServices(run)
): RestShrineReadModel => {
    const affordableCount = services.filter((service) => !service.purchased && restShrineServiceCanAfford(run, service)).length;
    const wallet = nonNegativeRestShrineCount(run.shopGold);
    return {
        serviceCount: services.length,
        availableCount: services.filter((service) => service.available && !service.purchased).length,
        affordableCount,
        purchasedCount: services.filter((service) => service.purchased).length,
        previewCopy: `${services.length} rest shrine services; ${affordableCount} affordable with ${wallet} shop gold.`
    };
};

export interface RestShrinePurchaseResult {
    run: RunState;
    services: RestShrineServiceState[];
    purchased: boolean;
    reason?: 'missing' | 'unavailable' | 'insufficient_funds' | 'sold_out';
    lives?: number;
    shopGold?: number;
    relicFavorProgress?: number;
}

const gainOneFavorProgress = (
    run: RunState
): Pick<RunState, 'bonusRelicPicksNextOffer' | 'favorBonusRelicPicksNextOffer' | 'relicFavorProgress'> => {
    const total = nonNegativeRestShrineCount(run.relicFavorProgress) + 1;
    const bonusPicks = Math.floor(total / 3);
    return {
        bonusRelicPicksNextOffer: nonNegativeRestShrineCount(run.bonusRelicPicksNextOffer) + bonusPicks,
        favorBonusRelicPicksNextOffer: nonNegativeRestShrineCount(run.favorBonusRelicPicksNextOffer) + bonusPicks,
        relicFavorProgress: total % 3
    };
};

export const purchaseRestShrineService = (
    run: RunState,
    services: readonly RestShrineServiceState[],
    serviceId: string
): RestShrinePurchaseResult => {
    const service = services.find((item) => item.id === serviceId);
    if (!service) {
        return { run, services: [...services], purchased: false, reason: 'missing' };
    }
    if (service.purchased) {
        return { run, services: [...services], purchased: false, reason: 'sold_out' };
    }
    if (!service.available) {
        return { run, services: [...services], purchased: false, reason: 'unavailable' };
    }
    if (!restShrineServiceCanAfford(run, service)) {
        return { run, services: [...services], purchased: false, reason: 'insufficient_funds' };
    }

    let nextRun: RunState = { ...run, shopGold: nonNegativeRestShrineCount(run.shopGold) - service.cost };
    if (service.serviceId === 'rest_heal') {
        nextRun = { ...nextRun, lives: Math.min(MAX_LIVES, nonNegativeRestShrineCount(nextRun.lives) + 1) };
    } else if (service.serviceId === 'guard_focus') {
        nextRun = {
            ...nextRun,
            stats: { ...nextRun.stats, guardTokens: Math.min(MAX_GUARD_TOKENS, nonNegativeRestShrineCount(nextRun.stats.guardTokens) + 1) }
        };
    } else if (service.serviceId === 'boss_ward') {
        nextRun = { ...nextRun, dungeonMasterKeys: nonNegativeRestShrineCount(nextRun.dungeonMasterKeys) + 1 };
    } else {
        nextRun = { ...nextRun, ...gainOneFavorProgress(nextRun) };
    }

    return {
        ...nextRun,
        run: nextRun,
        services: services.map((item) => (item.id === serviceId ? { ...item, purchased: true } : item)),
        purchased: true,
        lives: nextRun.lives,
        shopGold: nextRun.shopGold,
        relicFavorProgress: nextRun.relicFavorProgress
    };
};
