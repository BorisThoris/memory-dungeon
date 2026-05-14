import { describe, expect, it } from 'vitest';
import {
    BALANCE_SIMULATION_BASELINE,
    assertBalanceSimulationWithinBaseline,
    assertDungeonBalanceProfilesWithinBounds,
    DUNGEON_BALANCE_PROFILES,
    getFindableKindShares,
    runDungeonBalanceProfileSimulation,
    runBalanceSimulation
} from './balance-simulation';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, type FindableKind } from './contracts';

describe('REG-086 balance simulation economy and drop-rate tuning', () => {
    it('runs deterministic offline economy and drop-rate simulations', () => {
        const result = runBalanceSimulation({ seed: 42_001, floors: 12, rulesVersion: GAME_RULES_VERSION });

        expect(result.offlineOnly).toBe(true);
        expect(result.samples).toHaveLength(12);
        expect(result.aggregate.totalShopGoldEarned).toBeGreaterThan(0);
        expect(result.aggregate.findablePickupPairs).toBeGreaterThanOrEqual(12);
        expect(Object.values(result.aggregate.findableKindCounts).reduce((sum, count) => sum + count, 0)).toBe(
            result.aggregate.findablePickupPairs
        );
        expect(result.aggregate.bossFloors).toBe(2);
        expect(result.aggregate.breatherFloors).toBe(3);
        expect(result.aggregate.eliteFloors).toBeGreaterThan(0);
        expect(result.aggregate.enemyThreatPairs).toBeGreaterThan(0);
        expect(result.aggregate.movingEnemyHazards).toBeGreaterThan(0);
        expect(result.aggregate.bossMovingEnemyHazards).toBe(2);
        expect(result.aggregate.hazardTileCount).toBeGreaterThan(0);
        expect(result.aggregate.contactRisk).toBe(result.aggregate.movingEnemyHazards);
        expect(result.aggregate.shopSinkBudget).toBeGreaterThan(0);
        expect(result.aggregate.relicFavorPotential).toBeGreaterThan(0);
        expect(result.aggregate.comboShardPotential).toBeGreaterThan(0);
        expect(result.aggregate.guardRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.relicOfferAvailable).toBe(4);
        expect(result.aggregate.consumableRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.treasureRewardPairs).toBeGreaterThan(0);
        expect(result.aggregate.routeRewardPairs).toBeGreaterThanOrEqual(0);
        expect(result.aggregate.eventRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.roomRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.keyInflowPotential).toBeGreaterThan(0);
        expect(result.aggregate.shopGoldInflowPotential).toBeGreaterThan(result.aggregate.totalShopGoldEarned);
        expect(result.aggregate.destroyChargeInflowPotential).toBeGreaterThan(0);
        expect(result.aggregate.peekChargeInflowPotential).toBeGreaterThan(0);
        expect(result.rows.map((row) => row.key)).toEqual(
            expect.arrayContaining([
                'avg_moving_enemy_hazards_per_floor',
                'avg_hazard_tiles_per_floor',
                'avg_contact_risk_per_floor',
                'elite_route_node_share',
                'avg_relic_favor_potential_per_floor',
                'avg_combo_shard_potential_per_floor',
                'avg_guard_reward_potential_per_floor',
                'relic_offer_cadence',
                'avg_consumable_reward_potential_per_floor',
                'avg_treasure_reward_pairs_per_floor',
                'reward_band_spread',
                'avg_live_shop_gold_inflow_per_floor',
                'avg_route_reward_pairs_per_floor',
                'avg_event_room_reward_potential_per_floor',
                'avg_key_inflow_potential_per_floor',
                'avg_power_charge_inflow_per_floor',
                'findable_share_shard_spark',
                'findable_share_score_glint',
                'findable_share_ward_spark',
                'findable_share_scout_glint'
            ])
        );
        const newRewardRows = new Set([
            'findable_share_shard_spark',
            'findable_share_score_glint',
            'findable_share_ward_spark',
            'findable_share_scout_glint',
            'avg_relic_favor_potential_per_floor',
            'avg_combo_shard_potential_per_floor',
            'avg_guard_reward_potential_per_floor',
            'relic_offer_cadence',
            'avg_consumable_reward_potential_per_floor',
            'avg_treasure_reward_pairs_per_floor',
            'reward_band_spread',
            'avg_live_shop_gold_inflow_per_floor',
            'avg_route_reward_pairs_per_floor',
            'avg_event_room_reward_potential_per_floor',
            'avg_key_inflow_potential_per_floor',
            'avg_power_charge_inflow_per_floor'
        ]);
        expect(result.rows.filter((row) => newRewardRows.has(row.key) && row.status !== 'within_range')).toEqual([]);
        expect(result.samples.some((sample) => sample.dungeonNodeKind === 'elite' && sample.enemyThreatPairs >= 2)).toBe(
            true
        );
        expect(result.samples.every((sample) => sample.hazardTileCount > 0)).toBe(true);
        expect(new Set(result.samples.map((sample) => sample.floorBand))).toEqual(new Set(['early', 'mid', 'late']));
    });

    it('keeps weighted findable distribution broadly aligned across longer deterministic samples', () => {
        const result = runBalanceSimulation({
            seeds: [42_001, 42_777, 43_001, 44_001],
            floors: 48,
            rulesVersion: GAME_RULES_VERSION
        });
        const total = result.aggregate.findablePickupPairs;

        expect(total).toBeGreaterThan(0);
        expect(Object.values(result.aggregate.findableKindCounts).reduce((sum, count) => sum + count, 0)).toBe(total);
        const shares = getFindableKindShares(result.aggregate.findableKindCounts);

        const bounds: Record<FindableKind, { min: number; max: number }> = {
            shard_spark: { min: 0.2, max: 0.5 },
            score_glint: { min: 0.2, max: 0.5 },
            ward_spark: { min: 0.05, max: 0.3 },
            scout_glint: { min: 0.05, max: 0.3 }
        };

        for (const kind of Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS) as FindableKind[]) {
            const share = shares[kind];
            expect(share).toBeGreaterThanOrEqual(bounds[kind].min);
            expect(share).toBeLessThanOrEqual(bounds[kind].max);
        }
    });

    it('summarizes findable kind shares from aggregate counts', () => {
        expect(
            getFindableKindShares({
                shard_spark: 35,
                score_glint: 35,
                ward_spark: 15,
                scout_glint: 15
            })
        ).toEqual({
            shard_spark: 0.35,
            score_glint: 0.35,
            ward_spark: 0.15,
            scout_glint: 0.15
        });
        expect(
            getFindableKindShares({
                shard_spark: 0,
                score_glint: 0,
                ward_spark: 0,
                scout_glint: 0
            })
        ).toEqual({
            shard_spark: 0,
            score_glint: 0,
            ward_spark: 0,
            scout_glint: 0
        });
    });

    it('guards the shipped balance baseline against large drift', () => {
        const result = runBalanceSimulation({ seed: 42_001, floors: 12, rulesVersion: GAME_RULES_VERSION });
        const drift = assertBalanceSimulationWithinBaseline(result, BALANCE_SIMULATION_BASELINE);

        expect(drift.ok).toBe(true);
        expect(drift.issues).toEqual([]);
    });

    it('DNG-071 reports dungeon balance profiles with pressure, economy, boss, and shop metrics', () => {
        const result = runDungeonBalanceProfileSimulation({
            seeds: [42_001, 42_777],
            floors: 12,
            rulesVersion: GAME_RULES_VERSION
        });

        expect(result.profiles.map((profile) => profile.profile)).toEqual(DUNGEON_BALANCE_PROFILES.map((profile) => profile.id));
        for (const profile of result.profiles) {
            expect(profile.floorsCleared).toBeGreaterThan(0);
            expect(profile.livesLost).toBeGreaterThanOrEqual(0);
            expect(profile.guardUsed).toBeGreaterThanOrEqual(0);
            expect(profile.shopGoldEarned).toBeGreaterThan(0);
            expect(profile.rewardClaims).toBeGreaterThan(0);
            expect(profile.bossAttempts).toBeGreaterThan(0);
            expect(profile.shopsVisited).toBeGreaterThanOrEqual(0);
        }

        const greedy = result.profiles.find((profile) => profile.profile === 'greedy')!;
        const cautious = result.profiles.find((profile) => profile.profile === 'cautious')!;
        expect(greedy.rewardClaims).toBeGreaterThan(cautious.rewardClaims);
        expect(cautious.guardUsed).toBeGreaterThanOrEqual(greedy.guardUsed);
    });

    it('DNG-071 profile bounds fail with profile/seed/floor context', () => {
        const result = runDungeonBalanceProfileSimulation({ seed: 42_001, floors: 12, rulesVersion: GAME_RULES_VERSION });
        const healthy = assertDungeonBalanceProfilesWithinBounds(result);

        expect(healthy.ok).toBe(true);
        expect(healthy.issues).toEqual([]);

        const impossible = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            bounds: { ...result.bounds, minFloorsClearedShare: 1.1 }
        });
        expect(impossible.ok).toBe(false);
        expect(impossible.issues[0]).toMatch(/@(seed|seed:)/);
        expect(impossible.issues[0]).toMatch(/floor:/);
        expect(impossible.issues[0]).toMatch(/floorsCleared/);
    });
});
