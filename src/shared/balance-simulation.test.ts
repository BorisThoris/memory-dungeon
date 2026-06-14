import { describe, expect, it } from 'vitest';
import {
    BALANCE_SIMULATION_BASELINE,
    assertBalanceSimulationWithinBaseline,
    assertDungeonBalanceProfilesWithinBounds,
    DUNGEON_BALANCE_PROFILES,
    getFindableKindShares,
    getTileTraitKindShares,
    runDungeonBalanceProfileSimulation,
    runBalanceSimulation
} from './balance-simulation';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, type FindableKind, type TileTraitKind } from './contracts';

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
        expect(result.aggregate.tileTraitPairs).toBeGreaterThan(0);
        expect(Object.values(result.aggregate.tileTraitKindCounts).reduce((sum, count) => sum + count, 0)).toBe(
            result.aggregate.tileTraitPairs
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
        expect(result.aggregate.recoveryReliefPotential).toBeGreaterThan(0);
        expect(result.aggregate.netPressureAfterRelief).toBeGreaterThanOrEqual(0);
        expect(result.aggregate.highPressureLowRecoveryFloors).toBeGreaterThanOrEqual(0);
        expect(result.rows.map((row) => row.key)).toEqual(
            expect.arrayContaining([
                'avg_moving_enemy_hazards_per_floor',
                'avg_hazard_tiles_per_floor',
                'opener_hazard_tiles_per_seed',
                'avg_contact_risk_per_floor',
                'max_pressure_step_up',
                'avg_recovery_relief_on_pressure_floors',
                'max_recovery_debt_streak',
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
                'avg_tile_trait_pairs_per_floor',
                'tile_trait_share_echo',
                'tile_trait_share_volatile',
                'tile_trait_share_mirror',
                'tile_trait_share_cursed',
                'tile_trait_share_sealed',
                'tile_trait_share_heavy',
                'findable_share_shard_spark',
                'findable_share_score_glint',
                'findable_share_ward_spark',
                'findable_share_scout_glint'
            ])
        );
        const newRewardRows = new Set([
            'opener_hazard_tiles_per_seed',
            'max_pressure_step_up',
            'avg_recovery_relief_on_pressure_floors',
            'max_recovery_debt_streak',
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
            'avg_tile_trait_pairs_per_floor'
        ]);
        expect(result.rows.filter((row) => newRewardRows.has(row.key) && row.status !== 'within_range')).toEqual([]);
        expect(result.samples.some((sample) => sample.dungeonNodeKind === 'elite' && sample.enemyThreatPairs >= 2)).toBe(
            true
        );
        expect(result.samples.find((sample) => sample.floor === 1)?.hazardTileCount).toBe(0);
        expect(result.samples.filter((sample) => sample.floor > 1).every((sample) => sample.hazardTileCount > 0)).toBe(true);
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
            expect(profile.healingPurchased).toBeGreaterThanOrEqual(0);
            expect(profile.healingPurchaseShare).toBeGreaterThanOrEqual(0);
            expect(profile.minLivesRemaining).toBeGreaterThanOrEqual(1);
            expect(profile.runFalls).toBe(0);
            expect(profile.maxAtRiskStreak).toBeLessThanOrEqual(result.bounds.maxAtRiskStreak);
            expect(profile.lowLifeFloors).toBeGreaterThanOrEqual(0);
            expect(profile.lowLifeFloorShare).toBeLessThanOrEqual(result.bounds.maxLowLifeFloorShare);
            expect(profile.maxLowLifeStreak).toBeLessThanOrEqual(result.bounds.maxLowLifeStreak);
            expect(profile.unhealedLowLifeFloors).toBeGreaterThanOrEqual(0);
            expect(profile.unhealedLowLifeFloors).toBeLessThanOrEqual(profile.lowLifeFloors);
            expect(profile.unhealedLowLifeFloorShare).toBeLessThanOrEqual(result.bounds.maxUnhealedLowLifeFloorShare);
            expect(profile.maxUnhealedLowLifeStreak).toBeLessThanOrEqual(result.bounds.maxUnhealedLowLifeStreak);
            expect(profile.recoveryDebtFloors).toBeGreaterThanOrEqual(0);
            expect(profile.maxRecoveryDebtStreak).toBeLessThanOrEqual(result.bounds.maxRecoveryDebtStreak);
            expect(profile.routeChoiceCounts.safe + profile.routeChoiceCounts.greed + profile.routeChoiceCounts.mystery).toBe(
                profile.floorsCleared
            );
            expect(profile.dominantRouteShare).toBeLessThanOrEqual(result.bounds.maxDominantRouteShare);
            expect(profile.safeRouteTollSpend).toBeGreaterThanOrEqual(0);
            expect(profile.greedLifeCosts).toBeGreaterThanOrEqual(0);
            expect(profile.shopServiceSpend).toBeGreaterThan(0);
            expect(profile.shopGoldEarned).toBeGreaterThan(0);
            expect(profile.endingShopGold).toBeGreaterThanOrEqual(0);
            expect(profile.endingShopGold / result.base.samples.length).toBeLessThanOrEqual(
                result.bounds.maxEndingShopGoldPerFloor
            );
            expect(profile.maxShopGoldHeld).toBeGreaterThanOrEqual(profile.endingShopGold / result.base.seeds.length);
            expect(profile.maxShopGoldHeld / result.base.floors).toBeLessThanOrEqual(
                result.bounds.maxShopGoldHeldPerFloor
            );
            expect(profile.seedOutcomes).toHaveLength(result.base.seeds.length);
            expect(profile.seedOutcomes.map((outcome) => outcome.seed)).toEqual(result.base.seeds);
            expect(profile.seedOutcomes.reduce((sum, outcome) => sum + outcome.floorsCleared, 0)).toBe(
                profile.floorsCleared
            );
            expect(profile.seedOutcomes.reduce((sum, outcome) => sum + outcome.livesLost, 0)).toBe(profile.livesLost);
            expect(profile.worstSeedFloorsClearedShare).toBeGreaterThanOrEqual(
                result.bounds.minWorstSeedFloorsClearedShare
            );
            expect(profile.worstSeedLowLifeFloorShare).toBeLessThanOrEqual(
                result.bounds.maxWorstSeedLowLifeFloorShare
            );
            expect(profile.worstSeedUnhealedLowLifeFloorShare).toBeLessThanOrEqual(
                result.bounds.maxWorstSeedUnhealedLowLifeFloorShare
            );
            expect(profile.worstSeedRunFalls).toBeLessThanOrEqual(result.bounds.maxWorstSeedRunFalls);
            expect(profile.maxSeedEndingShopGold / result.base.floors).toBeLessThanOrEqual(
                result.bounds.maxSeedEndingShopGoldPerFloor
            );
            expect(profile.seedFloorClearShareSpread).toBeLessThanOrEqual(result.bounds.maxSeedFloorClearShareSpread);
            expect(profile.rewardClaims).toBeGreaterThan(0);
            expect(profile.bossAttempts).toBeGreaterThan(0);
            expect(profile.shopsVisited).toBeGreaterThanOrEqual(0);
        }

        const greedy = result.profiles.find((profile) => profile.profile === 'greedy')!;
        const cautious = result.profiles.find((profile) => profile.profile === 'cautious')!;
        const highSkill = result.profiles.find((profile) => profile.profile === 'high_skill')!;
        expect(greedy.rewardClaims).toBeGreaterThan(cautious.rewardClaims);
        expect(cautious.guardUsed).toBeGreaterThanOrEqual(greedy.guardUsed);
        expect(greedy.healingPurchased).toBeGreaterThanOrEqual(cautious.healingPurchased);
        expect(greedy.routeChoiceCounts.greed).toBeGreaterThan(cautious.routeChoiceCounts.greed);
        expect(cautious.routeChoiceCounts.safe).toBeGreaterThan(cautious.routeChoiceCounts.greed);
        expect(highSkill.safeRouteTollSpend).toBeGreaterThan(0);
        expect(greedy.safeRouteTollSpend).toBeGreaterThan(0);
        expect(greedy.greedLifeCosts).toBe(greedy.routeChoiceCounts.greed);
    });

    it('keeps tile trait distribution present across longer deterministic samples', () => {
        const result = runBalanceSimulation({
            seeds: [42_001, 42_777, 43_001, 44_001],
            floors: 48,
            rulesVersion: GAME_RULES_VERSION
        });
        const total = result.aggregate.tileTraitPairs;

        expect(total).toBeGreaterThan(0);
        expect(Object.values(result.aggregate.tileTraitKindCounts).reduce((sum, count) => sum + count, 0)).toBe(total);

        const shares = getTileTraitKindShares(result.aggregate.tileTraitKindCounts);
        const bounds: Record<TileTraitKind, { min: number; max: number }> = {
            echo: { min: 0.08, max: 0.35 },
            volatile: { min: 0.08, max: 0.35 },
            mirror: { min: 0.08, max: 0.35 },
            cursed: { min: 0.02, max: 0.28 },
            sealed: { min: 0.02, max: 0.28 },
            heavy: { min: 0.02, max: 0.28 }
        };

        for (const kind of Object.keys(bounds) as TileTraitKind[]) {
            expect(shares[kind]).toBeGreaterThanOrEqual(bounds[kind].min);
            expect(shares[kind]).toBeLessThanOrEqual(bounds[kind].max);
        }
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

        const deadRun = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [{ ...result.profiles[0]!, minLivesRemaining: 0, runFalls: 1 }]
        });
        expect(deadRun.ok).toBe(false);
        expect(deadRun.issues).toEqual(expect.arrayContaining([expect.stringMatching(/minLivesRemaining=0/)]));
        expect(deadRun.issues).toEqual(expect.arrayContaining([expect.stringMatching(/runFalls=1/)]));

        const routeDominated = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [{ ...result.profiles[0]!, dominantRouteShare: 0.95 }]
        });
        expect(routeDominated.ok).toBe(false);
        expect(routeDominated.issues).toEqual(expect.arrayContaining([expect.stringMatching(/dominantRouteShare=0.95/)]));

        const recoveryDebtCluster = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [{ ...result.profiles[0]!, maxRecoveryDebtStreak: 99 }]
        });
        expect(recoveryDebtCluster.ok).toBe(false);
        expect(recoveryDebtCluster.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/maxRecoveryDebtStreak=99/)])
        );

        const lowLifeExposure = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [{ ...result.profiles[0]!, lowLifeFloorShare: 0.99, maxLowLifeStreak: 99 }]
        });
        expect(lowLifeExposure.ok).toBe(false);
        expect(lowLifeExposure.issues).toEqual(expect.arrayContaining([expect.stringMatching(/lowLifeFloorShare=0.99/)]));
        expect(lowLifeExposure.issues).toEqual(expect.arrayContaining([expect.stringMatching(/maxLowLifeStreak=99/)]));

        const strandedLowLife = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [
                {
                    ...result.profiles[0]!,
                    unhealedLowLifeFloorShare: 0.99,
                    maxUnhealedLowLifeStreak: 99,
                    worstSeedUnhealedLowLifeFloorShare: 0.9
                }
            ]
        });
        expect(strandedLowLife.ok).toBe(false);
        expect(strandedLowLife.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/unhealedLowLifeFloorShare=0.99/)])
        );
        expect(strandedLowLife.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/maxUnhealedLowLifeStreak=99/)])
        );
        expect(strandedLowLife.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/worstSeedUnhealedLowLifeFloorShare=0.9/)])
        );

        const walletBloated = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [{ ...result.profiles[0]!, endingShopGold: 999, maxShopGoldHeld: 999 }]
        });
        expect(walletBloated.ok).toBe(false);
        expect(walletBloated.issues).toEqual(expect.arrayContaining([expect.stringMatching(/endingShopGold=999/)]));
        expect(walletBloated.issues).toEqual(expect.arrayContaining([expect.stringMatching(/maxShopGoldHeld=999/)]));

        const roughSeedHiddenByAggregate = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [
                {
                    ...result.profiles[0]!,
                    worstSeedFloorsClearedShare: 0.1,
                    worstSeedLowLifeFloorShare: 0.9,
                    worstSeedUnhealedLowLifeFloorShare: 0.9,
                    worstSeedRunFalls: 1,
                    maxSeedEndingShopGold: 999,
                    seedFloorClearShareSpread: 0.9
                }
            ]
        });
        expect(roughSeedHiddenByAggregate.ok).toBe(false);
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/worstSeedFloorsClearedShare=0.1/)])
        );
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/worstSeedLowLifeFloorShare=0.9/)])
        );
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/worstSeedUnhealedLowLifeFloorShare=0.9/)])
        );
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/worstSeedRunFalls=1/)])
        );
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/maxSeedEndingShopGold=999/)])
        );
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/seedFloorClearShareSpread=0.9/)])
        );
    });

    it('keeps long-run wallet growth and boss survivability inside profile bounds', () => {
        const result = runDungeonBalanceProfileSimulation({
            seeds: [42_001, 42_077, 42_123],
            floors: 48,
            rulesVersion: GAME_RULES_VERSION
        });
        const healthy = assertDungeonBalanceProfilesWithinBounds(result);

        expect(healthy.ok).toBe(true);
        expect(healthy.issues).toEqual([]);
    });

    it('keeps greedy reward upside bounded by route life costs', () => {
        const result = runDungeonBalanceProfileSimulation({
            seeds: [42_001, 42_077, 42_123],
            floors: 48,
            rulesVersion: GAME_RULES_VERSION
        });
        const cautious = result.profiles.find((profile) => profile.profile === 'cautious')!;
        const greedy = result.profiles.find((profile) => profile.profile === 'greedy')!;
        const highSkill = result.profiles.find((profile) => profile.profile === 'high_skill')!;

        expect(greedy.rewardClaims).toBeGreaterThan(highSkill.rewardClaims);
        expect(greedy.rewardClaims / cautious.rewardClaims).toBeLessThanOrEqual(1.6);
        expect(greedy.greedLifeCosts).toBe(greedy.routeChoiceCounts.greed);
        expect(greedy.greedLifeCosts).toBeGreaterThan(0);
        expect(greedy.lowLifeFloorShare).toBeGreaterThan(highSkill.lowLifeFloorShare);
        expect(greedy.minLivesRemaining).toBe(1);
        expect(greedy.runFalls).toBe(0);
    });
});
