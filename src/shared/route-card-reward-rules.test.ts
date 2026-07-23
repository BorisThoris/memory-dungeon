import { describe, expect, it } from 'vitest';

import {
    CATALYST_ALTAR_FALLBACK_SCORE_REWARD,
    CATALYST_ALTAR_UPGRADED_SCORE_REWARD,
    LOADED_GATEWAY_SCORE_REWARD,
    MAX_GUARD_TOKENS,
    MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD,
    MIMIC_CACHE_CONTROLLED_SCORE_REWARD,
    MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD,
    PARASITE_VESSEL_FALLBACK_SCORE_REWARD,
    type RunState
} from './contracts';
import { createNewRun } from './game-core';
import {
    ROUTE_CARD_GREED_SCORE_REWARD,
    ROUTE_CARD_GREED_SHOP_GOLD_REWARD,
    ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD
} from './route-choice-rules';
import { emptyRouteCardReward, getRouteCardReward } from './route-card-reward-rules';

describe('route card reward rules', () => {
    it('returns no reward for missing route card kind', () => {
        expect(getRouteCardReward(createNewRun(0), 1, 'a', null)).toEqual(emptyRouteCardReward());
    });

    it('converts guard cache into hazard wards when guard tokens are capped', () => {
        const run = {
            ...createNewRun(0),
            stats: { ...createNewRun(0).stats, guardTokens: MAX_GUARD_TOKENS }
        };

        expect(getRouteCardReward(run, 1, 'a', 'guard_cache')).toMatchObject({
            guardTokens: 0,
            safeHazardWardCharges: 1
        });
        expect(
            getRouteCardReward(
                { ...run, stats: { ...run.stats, guardTokens: Number.POSITIVE_INFINITY } },
                1,
                'a',
                'guard_cache'
            )
        ).toMatchObject({
            guardTokens: 1,
            safeHazardWardCharges: 0
        });
    });

    it('maps fixed route cache rewards', () => {
        expect(getRouteCardReward(createNewRun(0), 1, 'a', 'greed_cache')).toMatchObject({
            score: ROUTE_CARD_GREED_SCORE_REWARD,
            shopGold: ROUTE_CARD_GREED_SHOP_GOLD_REWARD
        });
        expect(getRouteCardReward(createNewRun(0), 1, 'a', 'loaded_gateway')).toMatchObject({
            score: LOADED_GATEWAY_SCORE_REWARD
        });
    });

    it('uses reveal state for mimic cache payouts', () => {
        expect(getRouteCardReward(createNewRun(0), 1, 'a', 'mimic_cache')).toMatchObject({
            shopGold: MIMIC_CACHE_BLIND_SHOP_GOLD_REWARD
        });
        expect(getRouteCardReward(createNewRun(0), 1, 'a', 'mimic_cache', true)).toMatchObject({
            score: MIMIC_CACHE_CONTROLLED_SCORE_REWARD,
            shopGold: MIMIC_CACHE_CONTROLLED_SHOP_GOLD_REWARD,
            comboShards: 1
        });
    });

    it('uses run state for catalyst and parasite rewards', () => {
        const run = createNewRun(0);

        expect(getRouteCardReward(run, 1, 'a', 'catalyst_altar')).toMatchObject({
            score: CATALYST_ALTAR_FALLBACK_SCORE_REWARD
        });
        expect(
            getRouteCardReward({ ...run, stats: { ...run.stats, comboShards: 1 } }, 1, 'a', 'catalyst_altar')
        ).toMatchObject({
            score: CATALYST_ALTAR_UPGRADED_SCORE_REWARD
        });
        expect(getRouteCardReward(run, 1, 'a', 'parasite_vessel')).toMatchObject({
            score: PARASITE_VESSEL_FALLBACK_SCORE_REWARD
        });
        expect(getRouteCardReward({ ...run, parasiteFloors: 1 }, 1, 'a', 'parasite_vessel')).toMatchObject({
            relicFavor: 1
        });
        expect(
            getRouteCardReward(
                { ...run, stats: { ...run.stats, comboShards: Number.POSITIVE_INFINITY } },
                1,
                'a',
                'catalyst_altar'
            )
        ).toMatchObject({
            score: CATALYST_ALTAR_FALLBACK_SCORE_REWARD
        });
        expect(getRouteCardReward({ ...run, parasiteFloors: Number.NaN }, 1, 'a', 'parasite_vessel')).toMatchObject({
            score: PARASITE_VESSEL_FALLBACK_SCORE_REWARD
        });
    });

    it('normalizes malformed stat records before stateful route-card rewards', () => {
        const run = {
            ...createNewRun(0),
            stats: Number.NaN as unknown as RunState['stats']
        };

        expect(getRouteCardReward(run, 1, 'a', 'guard_cache')).toMatchObject({
            guardTokens: 1,
            safeHazardWardCharges: 0
        });
        expect(getRouteCardReward(run, 1, 'a', 'catalyst_altar')).toMatchObject({
            score: CATALYST_ALTAR_FALLBACK_SCORE_REWARD
        });
    });

    it('selects each deterministic mystery veil reward lane', () => {
        const seen = new Set<string>();

        for (let seed = 0; seed < 100 && seen.size < 3; seed += 1) {
            const reward = getRouteCardReward({ ...createNewRun(0), runSeed: seed }, 3, `pair-${seed}`, 'mystery_veil');
            if (reward.shopGold === ROUTE_CARD_MYSTERY_SHOP_GOLD_REWARD) {
                seen.add('shop_gold');
            }
            if (reward.comboShards === 1) {
                seen.add('combo_shard');
            }
            if (reward.relicFavor === 1) {
                seen.add('relic_favor');
            }
        }

        expect(seen).toEqual(new Set(['shop_gold', 'combo_shard', 'relic_favor']));
    });
});
