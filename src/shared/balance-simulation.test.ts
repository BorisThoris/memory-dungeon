import { describe, expect, it } from 'vitest';
import {
    BALANCE_SIMULATION_BASELINE,
    BALANCE_SIMULATION_BASELINE_KEYS,
    BALANCE_SIMULATION_FINDABLE_KINDS,
    BALANCE_SIMULATION_FLOOR_BANDS,
    BALANCE_SIMULATION_TILE_TRAIT_KINDS,
    assertBalanceSimulationWithinBaseline,
    getFindableKindShares,
    getTileTraitKindShares,
    runBalanceSimulation,
    type BalanceSimulationFloorBand,
    type BalanceSimulationReport
} from './balance-simulation';
import { GAME_RULES_VERSION, type FindableKind, type TileTraitKind } from './contracts';
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
        expect(result.aggregate.boardFairnessIssueCount).toBe(0);
        expect(Object.keys(result.aggregate)).not.toEqual(
            expect.arrayContaining([expect.stringMatching(/Potential|RewardPairs|eliteFloors/u)])
        );
        expect(result.rows.map((row) => row.key)).toEqual(
            expect.arrayContaining([
                'avg_findable_pairs_per_floor',
                'findable_band_spread',
                'board_fairness_issue_floor_share',
                'boss_floor_share',
                'avg_tile_trait_pairs_per_floor',
                'avg_trait_combo_opportunity_pairs_per_floor',
                'trait_match_route_floor_share',
                'avg_trait_swap_setup_opportunities_per_floor',
                'avg_trait_interaction_lines_per_floor',
                'trait_reward_pickup_floor_share',
                'trait_board_power_interaction_floor_share',
                'dead_trait_floor_share',
                'tile_trait_share_echo',
                'tile_trait_share_heavy',
                'tile_trait_share_conduit',
                'tile_trait_share_stasis',
                'findable_share_shard_spark',
                'findable_share_score_glint'
            ])
        );
        expect(result.rows.map((row) => row.key).filter((key) => /route|event|room|elite|potential/u.test(key))).toEqual([
            'trait_match_route_floor_share'
        ]);
        const guardedRows = new Set([
            'avg_findable_pairs_per_floor',
            'findable_band_spread',
            'board_fairness_issue_floor_share',
            'avg_tile_trait_pairs_per_floor',
            'avg_trait_combo_opportunity_pairs_per_floor',
            'trait_match_route_floor_share',
            'avg_trait_swap_setup_opportunities_per_floor',
            'avg_trait_interaction_lines_per_floor',
            'trait_reward_pickup_floor_share',
            'trait_board_power_interaction_floor_share',
            'dead_trait_floor_share'
        ]);
        expect(result.rows.filter((row) => guardedRows.has(row.key) && row.status !== 'within_range')).toEqual([]);
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
                shard_spark: { min: 0.35, max: 0.65 },
                score_glint: { min: 0.35, max: 0.65 }
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
        expect(getFindableKindShares({ shard_spark: 30, score_glint: 70 })).toEqual({
            shard_spark: 0.3,
            score_glint: 0.7
        });
        expect(getFindableKindShares({ shard_spark: 0, score_glint: 0 })).toEqual({
            shard_spark: 0,
            score_glint: 0
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
            // Four kinds share the pool; the seeds lean on Conduit because it is the trait that pays
            // for a neighbour, so it may sit above an even quarter and the others a little below.
            const bounds: Record<TileTraitKind, { min: number; max: number }> = {
                echo: { min: 0.12, max: 0.4 },
                heavy: { min: 0.12, max: 0.4 },
                conduit: { min: 0.2, max: 0.5 },
                stasis: { min: 0.12, max: 0.4 }
            };

            for (const kind of BALANCE_SIMULATION_TILE_TRAIT_KINDS) {
                expect(shares[kind]).toBeGreaterThanOrEqual(bounds[kind].min);
                expect(shares[kind]).toBeLessThanOrEqual(bounds[kind].max);
            }
        },
        LONG_SIMULATION_TIMEOUT_MS
    );
});
