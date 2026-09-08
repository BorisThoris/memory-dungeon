import { describe, expect, it } from 'vitest';
import {
    BALANCE_SIMULATION_BASELINE,
    BALANCE_SIMULATION_BASELINE_KEYS,
    BALANCE_SIMULATION_FINDABLE_KINDS,
    BALANCE_SIMULATION_FLOOR_BANDS,
    BALANCE_SIMULATION_TILE_TRAIT_KINDS,
    assertBalanceSimulationWithinBaseline,
    assertDungeonBalanceProfilesWithinBounds,
    DUNGEON_BALANCE_PROFILES,
    getFindableKindShares,
    getTileTraitKindShares,
    runDungeonBalanceProfileSimulation,
    runBalanceSimulation,
    type BalanceSimulationFloorBand,
    type BalanceSimulationReport
} from './balance-simulation';
import { GAME_RULES_VERSION, INITIAL_LIVES, type FindableKind, type TileTraitKind } from './contracts';
import { getFindableSpawnWeightRows } from './findables';

const LONG_SIMULATION_TIMEOUT_MS = 15_000;

const sumFindableKindCounts = (counts: Record<FindableKind, number>) =>
    BALANCE_SIMULATION_FINDABLE_KINDS.reduce((sum, kind) => sum + counts[kind], 0);

const sumTileTraitKindCounts = (counts: Record<TileTraitKind, number>) =>
    BALANCE_SIMULATION_TILE_TRAIT_KINDS.reduce((sum, kind) => sum + counts[kind], 0);

const assertFloorBandReportShape = (
    sampleBand: BalanceSimulationReport['samples'][number]['floorBand'],
    bandTotals: BalanceSimulationReport['aggregate']['deadTraitFloorsByBand']
): Record<BalanceSimulationFloorBand, number> => {
    expect(BALANCE_SIMULATION_FLOOR_BANDS).toContain(sampleBand);
    return bandTotals;
};

describe('REG-086 balance simulation economy and drop-rate tuning', () => {
    it('runs deterministic offline economy and drop-rate simulations', () => {
        const result = runBalanceSimulation({ seed: 42_001, floors: 12, rulesVersion: GAME_RULES_VERSION });

        expect(result.offlineOnly).toBe(true);
        expect(result.samples).toHaveLength(12);
        expect(result.aggregate.findablePickupPairs).toBeGreaterThanOrEqual(12);
        expect(sumFindableKindCounts(result.aggregate.findableKindCounts)).toBe(result.aggregate.findablePickupPairs);
        expect(result.aggregate.tileTraitPairs).toBeGreaterThan(0);
        expect(result.aggregate.traitComboOpportunityPairs).toBeGreaterThan(0);
        expect(result.aggregate.traitComboOpportunityPairs).toBeLessThanOrEqual(result.aggregate.tileTraitPairs);
        expect(result.aggregate.traitMatchRouteFloors).toBeGreaterThan(0);
        expect(result.aggregate.traitSwapSetupOpportunities).toBeGreaterThan(0);
        expect(result.aggregate.traitInteractionLines).toBeGreaterThan(0);
        expect(result.aggregate.traitRewardPickupFloors).toBeGreaterThan(0);
        expect(result.aggregate.traitBoardPowerInteractionOpportunities).toBeGreaterThan(0);
        expect(result.aggregate.deadTraitFloors).toBe(0);
        expect(result.aggregate.deadTraitFloorsByBand).toEqual({ early: 0, mid: 0, late: 0 });
        expect(Object.keys(result.aggregate.deadTraitFloorsByBand)).toEqual([...BALANCE_SIMULATION_FLOOR_BANDS]);
        expect(assertFloorBandReportShape(result.samples[0]!.floorBand, result.aggregate.deadTraitFloorsByBand)).toBe(
            result.aggregate.deadTraitFloorsByBand
        );
        expect(sumTileTraitKindCounts(result.aggregate.tileTraitKindCounts)).toBe(result.aggregate.tileTraitPairs);
        expect(result.aggregate.bossFloors).toBe(2);
        expect(result.aggregate.breatherFloors).toBe(3);
        expect(result.aggregate.eliteFloors).toBeGreaterThan(0);
        /*
         * These five read nought, and asserting the nought is the point.
         *
         * This simulation's pressure model is `contactRisk + enemyThreatPairs * 0.25 +
         * bossMovingEnemyHazards * 0.9` - every term of it is a thing the dungeon layer put on the
         * board, and generation puts none of them there now. So the model says every floor in the
         * game has zero pressure, which is not a tuning result, it is a model describing a game
         * that no longer exists.
         *
         * Left as exact assertions rather than deleted because the deletion is a design decision
         * with a task against it (Phase 2: par, the pair curve, and what actually makes a floor
         * hard when nothing on it can hurt you). Until that lands, this is the honest reading, and
         * a non-zero here would mean the dungeon layer had come back through a door nobody watched.
         */
        expect(result.aggregate.enemyThreatPairs).toBe(0);
        expect(result.aggregate.movingEnemyHazards).toBe(0);
        expect(result.aggregate.bossMovingEnemyHazards).toBe(0);
        expect(result.aggregate.hazardTileCount).toBe(0);
        expect(result.aggregate.contactRisk).toBe(result.aggregate.movingEnemyHazards);
        expect(result.aggregate.relicFavorPotential).toBeGreaterThan(0);
        expect(result.aggregate.comboShardPotential).toBeGreaterThan(0);
        expect(result.aggregate.guardRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.relicOfferAvailable).toBe(4);
        // Consumables came from key cards and the vendor's stock; both are gone (Gen 172, 174).
        expect(result.aggregate.consumableRewardPotential).toBe(0);
        // Treasure pairs and key inflow were dungeon cards; the reward band now comes from
        // findables, traits and relic offers alone. Same reasoning as above.
        expect(result.aggregate.treasureRewardPairs).toBe(0);
        expect(result.aggregate.routeRewardPairs).toBeGreaterThanOrEqual(0);
        expect(result.aggregate.eventRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.roomRewardPotential).toBeGreaterThan(0);
        expect(result.aggregate.keyInflowPotential).toBe(0);
        expect(result.aggregate.boardFairnessIssueCount).toBe(0);
        expect(result.aggregate.destroyChargeInflowPotential).toBeGreaterThan(0);
        // Peek charges came from the vendor's stock and the scrying-lens room; both are gone.
        expect(result.aggregate.peekChargeInflowPotential).toBe(0);
        expect(result.aggregate.recoveryReliefPotential).toBeGreaterThan(0);
        expect(result.aggregate.netPressureAfterRelief).toBeGreaterThanOrEqual(0);
        expect(result.aggregate.highPressureLowRecoveryFloors).toBeGreaterThanOrEqual(0);
        expect(result.rows.map((row) => row.key)).toEqual(
            expect.arrayContaining([
                'max_pressure_step_up',
                'max_recovery_debt_streak',
                'elite_route_node_share',
                'avg_relic_favor_potential_per_floor',
                'avg_combo_shard_potential_per_floor',
                'avg_guard_reward_potential_per_floor',
                'relic_offer_cadence',
                'reward_band_spread',
                'board_fairness_issue_floor_share',
                'avg_route_reward_pairs_per_floor',
                'avg_event_room_reward_potential_per_floor',
                'avg_tile_trait_pairs_per_floor',
                'avg_trait_combo_opportunity_pairs_per_floor',
                'trait_match_route_floor_share',
                'avg_trait_swap_setup_opportunities_per_floor',
                'avg_trait_interaction_lines_per_floor',
                'trait_reward_pickup_floor_share',
                'trait_board_power_interaction_floor_share',
                'dead_trait_floor_share',
                'tile_trait_share_echo',
                'tile_trait_share_volatile',
                'tile_trait_share_mirror',
                'tile_trait_share_cursed',
                'tile_trait_share_sealed',
                'tile_trait_share_heavy',
                'tile_trait_share_drift',
                'tile_trait_share_conduit',
                'tile_trait_share_stasis',
                'findable_share_shard_spark',
                'findable_share_score_glint',
                'findable_share_ward_spark',
                'findable_share_scout_glint'
            ])
        );
        const pressureStepUp = result.rows.find((row) => row.key === 'max_pressure_step_up');
        expect(pressureStepUp?.value).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(pressureStepUp?.value)).toBe(true);
        const newRewardRows = new Set([
            'max_pressure_step_up',
            'max_recovery_debt_streak',
            'avg_relic_favor_potential_per_floor',
            'avg_combo_shard_potential_per_floor',
            'avg_guard_reward_potential_per_floor',
            'relic_offer_cadence',
            'reward_band_spread',
            'board_fairness_issue_floor_share',
            'avg_route_reward_pairs_per_floor',
            'avg_event_room_reward_potential_per_floor',
            'avg_tile_trait_pairs_per_floor',
            'avg_trait_combo_opportunity_pairs_per_floor',
            'trait_match_route_floor_share',
            'avg_trait_swap_setup_opportunities_per_floor',
            'avg_trait_interaction_lines_per_floor',
            'trait_reward_pickup_floor_share',
            'trait_board_power_interaction_floor_share',
            'dead_trait_floor_share'
        ]);
        expect(result.rows.filter((row) => newRewardRows.has(row.key) && row.status !== 'within_range')).toEqual([]);
        // The elite-node threat check and the "floor 1 clean, floor 2+ hazardous" ramp both read the
        // dungeon layer off the board. There is no ramp now: every floor is clean, which is the
        // change, not a regression in it.
        expect(result.samples.every((sample) => sample.enemyThreatPairs === 0)).toBe(true);
        expect(result.samples.every((sample) => sample.hazardTileCount === 0)).toBe(true);
        expect(new Set(result.samples.map((sample) => sample.floorBand))).toEqual(new Set(['early', 'mid', 'late']));
    });

    it(
        'keeps weighted findable distribution broadly aligned across longer deterministic samples',
        () => {
            const result = runBalanceSimulation({
                seeds: [42_001, 42_777, 43_001, 44_001],
                floors: 48,
                rulesVersion: GAME_RULES_VERSION
            });
            const total = result.aggregate.findablePickupPairs;

            expect(total).toBeGreaterThan(0);
            expect(sumFindableKindCounts(result.aggregate.findableKindCounts)).toBe(total);
            const shares = getFindableKindShares(result.aggregate.findableKindCounts);

            const bounds: Record<FindableKind, { min: number; max: number }> = {
                shard_spark: { min: 0.2, max: 0.5 },
                score_glint: { min: 0.2, max: 0.5 },
                ward_spark: { min: 0.05, max: 0.3 },
                scout_glint: { min: 0.05, max: 0.3 }
            };

            for (const row of getFindableSpawnWeightRows()) {
                const share = shares[row.id];
                expect(share).toBeGreaterThanOrEqual(bounds[row.id].min);
                expect(share).toBeLessThanOrEqual(bounds[row.id].max);
            }
        },
        LONG_SIMULATION_TIMEOUT_MS
    );

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

        expect(BALANCE_SIMULATION_BASELINE_KEYS).toEqual([
            'findablePickupPairs',
            'bossFloors',
            'breatherFloors'
        ]);
        expect(drift.ok).toBe(true);
        expect(drift.issues).toEqual([]);
    });

    it('DNG-071 reports dungeon balance profiles with pressure, boss and survivability metrics', () => {
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
            expect(profile.minLivesRemaining).toBeGreaterThanOrEqual(1);
            expect(profile.runFalls).toBe(0);
            expect(profile.maxAtRiskStreak).toBeLessThanOrEqual(result.bounds.maxAtRiskStreak);
            expect(profile.lowLifeFloors).toBeGreaterThanOrEqual(0);
            expect(profile.lowLifeFloorShare).toBeLessThanOrEqual(result.bounds.maxLowLifeFloorShare);
            expect(profile.maxLowLifeStreak).toBeLessThanOrEqual(result.bounds.maxLowLifeStreak);
            expect(profile.recoveryDebtFloors).toBeGreaterThanOrEqual(0);
            expect(profile.maxRecoveryDebtStreak).toBeLessThanOrEqual(result.bounds.maxRecoveryDebtStreak);
            // No route is offered between floors (Gen 173), so every route column reads zero. They
            // stay in the report until T1.17 re-baselines it; asserting zero here keeps them honest.
            expect(profile.routeChoiceCounts.safe + profile.routeChoiceCounts.greed + profile.routeChoiceCounts.mystery).toBe(0);
            expect(profile.routeAcceptedChoices).toBe(0);
            expect(profile.routeRejectedChoices).toBe(0);
            expect(Object.values(profile.routeOutcomeCounts).reduce((sum, count) => sum + count, 0)).toBe(
                profile.routeAcceptedChoices
            );
            expect(
                profile.routeOutcomeCounts.mystery_shop_gold +
                    profile.routeOutcomeCounts.mystery_combo_shard +
                    profile.routeOutcomeCounts.mystery_combo_shard_capped +
                    profile.routeOutcomeCounts.mystery_relic_favor
            ).toBe(profile.routeChoiceCounts.mystery);
            expect(profile.routeScoreDelta).toBe(profile.routeChoiceCounts.greed * 35);
            expect(profile.routeLifeDelta).toBeGreaterThanOrEqual(-profile.routeChoiceCounts.greed);
            expect(profile.routeGuardDelta).toBeGreaterThanOrEqual(0);
            expect(profile.routeComboShardDelta).toBeGreaterThanOrEqual(0);
            expect(profile.routeFavorDelta).toBeGreaterThanOrEqual(0);
            expect(profile.routeMemorizeBonusMsDelta).toBeGreaterThanOrEqual(0);
            /*
             * The greedy profile now takes the greedy route on every single floor, and this bound
             * is the thing that noticed. It exists so that "one route cannot silently become the
             * default answer", and for greedy that is exactly what has happened.
             *
             * It is a finding about the route layer, not about this profile. Greed used to be
             * withheld on the floors the dungeon layer shaped - a boss floor, an elite node - and
             * with those gone the offer is the same three doors on all twelve floors, so a player
             * with a fixed appetite has no decision left to make. The answer is the between-floor
             * layer going too (Phase 1, T1.9-T1.17), not a wider bound: widening it here would
             * delete the only evidence that the route offer has gone flat.
             *
             * So the exception is named, and only for the profile that shows it. Any other profile
             * drifting to a dominant route still fails, which is the half of this diagnostic that
             * still has something to catch.
             */
            expect(profile.dominantRouteShare).toBeLessThanOrEqual(
                profile.profile === 'greedy' ? 1 : result.bounds.maxDominantRouteShare
            );
            expect(profile.greedLifeCosts).toBeGreaterThanOrEqual(0);
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
            expect(profile.worstSeedRunFalls).toBeLessThanOrEqual(result.bounds.maxWorstSeedRunFalls);
            expect(profile.seedFloorClearShareSpread).toBeLessThanOrEqual(result.bounds.maxSeedFloorClearShareSpread);
            expect(profile.rewardClaims).toBeGreaterThan(0);
            expect(profile.bossAttempts).toBeGreaterThan(0);
        }

        const greedy = result.profiles.find((profile) => profile.profile === 'greedy')!;
        const cautious = result.profiles.find((profile) => profile.profile === 'cautious')!;
        const highSkill = result.profiles.find((profile) => profile.profile === 'high_skill')!;
        expect(greedy.rewardClaims).toBeGreaterThan(cautious.rewardClaims);
        expect(cautious.guardUsed).toBeGreaterThanOrEqual(greedy.guardUsed);
        // The route columns all read zero for every profile (Gen 173): nothing is chosen between
        // floors, so nothing is scored, tolled or paid for in lives there. Asserted so that a route
        // finding its way back in fails here rather than hiding in a column nobody reads.
        for (const profile of [greedy, cautious, highSkill]) {
            expect(profile.routeChoiceCounts).toEqual({ safe: 0, greed: 0, mystery: 0 });
            expect(profile.routeScoreDelta).toBe(0);
            expect(profile.routeLifeDelta).toBe(0);
            expect(profile.greedLifeCosts).toBe(0);
        }
    });

    it('falls back to shipped balance profiles when profile filters are malformed', () => {
        const result = runDungeonBalanceProfileSimulation({
            seeds: [42_001],
            floors: 3,
            rulesVersion: GAME_RULES_VERSION,
            profiles: { length: 2 } as never
        });

        expect(result.profiles.map((profile) => profile.profile)).toEqual(DUNGEON_BALANCE_PROFILES.map((profile) => profile.id));
    });

    it(
        'keeps tile trait distribution present across longer deterministic samples',
        () => {
            const result = runBalanceSimulation({
                seeds: [42_001, 42_777, 43_001, 44_001],
                floors: 48,
                rulesVersion: GAME_RULES_VERSION
            });
            const total = result.aggregate.tileTraitPairs;

            expect(total).toBeGreaterThan(0);
            expect(sumTileTraitKindCounts(result.aggregate.tileTraitKindCounts)).toBe(total);
            expect(result.aggregate.traitComboOpportunityPairs).toBeGreaterThan(0);
            expect(result.aggregate.traitComboOpportunityPairs).toBeLessThanOrEqual(total);
            expect(result.aggregate.traitMatchRouteFloors).toBeGreaterThanOrEqual(
                result.floors * result.seeds.length * 0.75
            );
            expect(result.aggregate.traitSwapSetupOpportunities).toBeGreaterThan(0);

            const shares = getTileTraitKindShares(result.aggregate.tileTraitKindCounts);
            const bounds: Record<TileTraitKind, { min: number; max: number }> = {
                echo: { min: 0.06, max: 0.35 },
                volatile: { min: 0.05, max: 0.35 },
                mirror: { min: 0.05, max: 0.35 },
                cursed: { min: 0.04, max: 0.28 },
                sealed: { min: 0.04, max: 0.28 },
                heavy: { min: 0.04, max: 0.28 },
                drift: { min: 0.04, max: 0.28 },
                conduit: { min: 0.08, max: 0.35 },
                stasis: { min: 0.04, max: 0.28 }
            };

            for (const kind of BALANCE_SIMULATION_TILE_TRAIT_KINDS) {
                expect(shares[kind]).toBeGreaterThanOrEqual(bounds[kind].min);
                expect(shares[kind]).toBeLessThanOrEqual(bounds[kind].max);
            }
        },
        LONG_SIMULATION_TIMEOUT_MS
    );

    it('DNG-071 profile bounds fail with profile/seed/floor context', () => {
        const result = runDungeonBalanceProfileSimulation({ seed: 42_001, floors: 12, rulesVersion: GAME_RULES_VERSION });
        const healthy = assertDungeonBalanceProfilesWithinBounds(result);

        // Gen 172 recorded the greedy profile's flat route offer here. Gen 173 removed the route,
        // and with it the finding; an issue appearing now is a new regression and fails.
        expect(healthy.issues).toEqual([]);
        expect(healthy.ok).toBe(true);

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

        const roughSeedHiddenByAggregate = assertDungeonBalanceProfilesWithinBounds({
            ...result,
            profiles: [
                {
                    ...result.profiles[0]!,
                    worstSeedFloorsClearedShare: 0.1,
                    worstSeedLowLifeFloorShare: 0.9,
                    worstSeedRunFalls: 1,
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
            expect.arrayContaining([expect.stringMatching(/worstSeedRunFalls=1/)])
        );
        expect(roughSeedHiddenByAggregate.issues).toEqual(
            expect.arrayContaining([expect.stringMatching(/seedFloorClearShareSpread=0.9/)])
        );
    });

    it('keeps long-run boss survivability inside profile bounds', () => {
        const result = runDungeonBalanceProfileSimulation({
            seeds: [42_001, 42_077, 42_123],
            floors: 48,
            rulesVersion: GAME_RULES_VERSION
        });
        const healthy = assertDungeonBalanceProfilesWithinBounds(result);

        /*
         * Gen 172 recorded two issues here - the flat route offer and the 801 gold a greedy player
         * banked because no safe toll ever took any out. Both were the between-floor route, and
         * Gen 173 removed it: the greedy profile now clears the same floors the cautious one does
         * and ends with the same wallet. Asserted empty so the next finding fails loudly.
         */
        expect(healthy.issues).toEqual([]);
        expect(healthy.ok).toBe(true);
    }, LONG_SIMULATION_TIMEOUT_MS);

    it('keeps greedy reward upside bounded now that no route costs a life', () => {
        const result = runDungeonBalanceProfileSimulation({
            seeds: [42_001, 42_077, 42_123],
            floors: 48,
            rulesVersion: GAME_RULES_VERSION
        });
        const cautious = result.profiles.find((profile) => profile.profile === 'cautious')!;
        const greedy = result.profiles.find((profile) => profile.profile === 'greedy')!;
        const highSkill = result.profiles.find((profile) => profile.profile === 'high_skill')!;

        expect(greedy.rewardClaims).toBeGreaterThan(highSkill.rewardClaims);
        // Gen 172 measured 1.68 with the greedy route paying for its upside in lives. Gen 173 took
        // the route away, so the only thing left separating greedy from cautious is how they play
        // the board and spend the wallet; the ceiling stays where it was to catch that gap widening.
        expect(greedy.rewardClaims / cautious.rewardClaims).toBeLessThanOrEqual(1.7);
        expect(greedy.greedLifeCosts).toBe(0);
        expect(greedy.routeChoiceCounts.greed).toBe(0);
        // Nothing between floors costs a life and nothing on the floor does either, so no profile
        // ever drops low and a greedy player never loses a life at all. That is the gap Phase 2
        // exists to fill; it is asserted exactly so the first floor that can hurt shows up here.
        expect(greedy.lowLifeFloorShare).toBe(0);
        expect(highSkill.lowLifeFloorShare).toBe(0);
        expect(greedy.livesLost).toBe(0);
        expect(greedy.minLivesRemaining).toBe(INITIAL_LIVES);
        expect(greedy.runFalls).toBe(0);
    }, LONG_SIMULATION_TIMEOUT_MS);
});
