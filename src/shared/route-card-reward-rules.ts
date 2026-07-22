import {
    CATALYST_ALTAR_FALLBACK_SCORE_REWARD,
    CATALYST_ALTAR_UPGRADED_SCORE_REWARD,
    LOADED_GATEWAY_SCORE_REWARD,
    MAX_GUARD_TOKENS,
    MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD,
    MIMIC_CACHE_CONTROLLED_SCORE_REWARD,
    MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD,
    PARASITE_VESSEL_FALLBACK_SCORE_REWARD,
    type RouteCardKind,
    type RouteSpecialKind,
    type RunState
} from './contracts';
import { hashStringToSeed } from './rng';
import {
    ROUTE_CARD_GREED_SCORE_REWARD,
    ROUTE_CARD_GREED_SHOP_GOLD_REWARD,
    ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD
} from './route-choice-rules';
import { normalizeSessionStats } from './session-stats-rules';

type MysteryRouteCardOutcome = 'shop_gold' | 'combo_shard' | 'relic_favor';

export interface RouteCardReward {
    score: number;
    shopGold: number;
    guardTokens: number;
    safeHazardWardCharges: number;
    comboShards: number;
    relicFavor: number;
}

export const emptyRouteCardReward = (): RouteCardReward => ({
    score: 0,
    shopGold: 0,
    guardTokens: 0,
    safeHazardWardCharges: 0,
    comboShards: 0,
    relicFavor: 0
});

const nonNegativeRouteCardRewardCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const mysteryRouteCardOutcomeFor = (run: RunState, level: number, pairKey: string): MysteryRouteCardOutcome => {
    const outcomes: MysteryRouteCardOutcome[] = ['shop_gold', 'combo_shard', 'relic_favor'];
    const seed = hashStringToSeed(`routeCardMystery:${run.runRulesVersion}:${run.runSeed}:${level}:${pairKey}`);
    return outcomes[Math.abs(seed) % outcomes.length] ?? 'relic_favor';
};

export const getRouteCardReward = (
    run: RunState,
    level: number,
    pairKey: string,
    kind: RouteSpecialKind | RouteCardKind | null,
    routeSpecialRevealed = false
): RouteCardReward => {
    const stats = normalizeSessionStats(run.stats);
    if (kind === 'safe_ward') {
        return { ...emptyRouteCardReward(), guardTokens: 1 };
    }
    if (kind === 'guard_cache') {
        return stats.guardTokens >= MAX_GUARD_TOKENS
            ? { ...emptyRouteCardReward(), safeHazardWardCharges: 1 }
            : { ...emptyRouteCardReward(), guardTokens: 1 };
    }
    if (kind === 'greed_cache') {
        return {
            ...emptyRouteCardReward(),
            score: ROUTE_CARD_GREED_SCORE_REWARD,
            shopGold: ROUTE_CARD_GREED_SHOP_GOLD_REWARD
        };
    }
    if (kind === 'elite_cache') {
        return {
            ...emptyRouteCardReward(),
            score: 55,
            shopGold: 4
        };
    }
    if (kind === 'final_ward') {
        return {
            ...emptyRouteCardReward(),
            guardTokens: 1,
            comboShards: 1
        };
    }
    if (kind === 'greed_toll') {
        return {
            ...emptyRouteCardReward(),
            score: 40,
            shopGold: 3
        };
    }
    if (kind === 'fragile_cache') {
        return {
            ...emptyRouteCardReward(),
            score: 20,
            shopGold: 1
        };
    }
    if (kind === 'lantern_ward') {
        return {
            ...emptyRouteCardReward(),
            score: 10,
            guardTokens: 1
        };
    }
    if (kind === 'secret_door') {
        return {
            ...emptyRouteCardReward(),
            relicFavor: 1
        };
    }
    if (kind === 'omen_seal') {
        return {
            ...emptyRouteCardReward(),
            relicFavor: 1,
            comboShards: 1
        };
    }
    if (kind === 'mimic_cache') {
        return routeSpecialRevealed
            ? {
                  ...emptyRouteCardReward(),
                  score: MIMIC_CACHE_CONTROLLED_SCORE_REWARD,
                  shopGold: MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD,
                  comboShards: 1
              }
            : {
                  ...emptyRouteCardReward(),
                  shopGold: MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD
              };
    }
    if (kind === 'loaded_gateway') {
        return {
            ...emptyRouteCardReward(),
            score: LOADED_GATEWAY_SCORE_REWARD
        };
    }
    if (kind === 'catalyst_altar') {
        return {
            ...emptyRouteCardReward(),
            score:
                stats.comboShards > 0
                    ? CATALYST_ALTAR_UPGRADED_SCORE_REWARD
                    : CATALYST_ALTAR_FALLBACK_SCORE_REWARD
        };
    }
    if (kind === 'parasite_vessel') {
        return nonNegativeRouteCardRewardCount(run.parasiteFloors) > 0
            ? {
                  ...emptyRouteCardReward(),
                  relicFavor: 1
              }
            : {
                  ...emptyRouteCardReward(),
                  score: PARASITE_VESSEL_FALLBACK_SCORE_REWARD
              };
    }
    if (kind === 'keystone_pair') {
        return {
            ...emptyRouteCardReward(),
            score: 45,
            relicFavor: 1
        };
    }
    if (kind === 'mystery_veil') {
        const outcome = mysteryRouteCardOutcomeFor(run, level, pairKey);
        if (outcome === 'shop_gold') {
            return { ...emptyRouteCardReward(), shopGold: ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD };
        }
        if (outcome === 'combo_shard') {
            return { ...emptyRouteCardReward(), comboShards: 1 };
        }
        return { ...emptyRouteCardReward(), relicFavor: 1 };
    }
    return emptyRouteCardReward();
};
