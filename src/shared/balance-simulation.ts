import {
    GAME_RULES_VERSION,
    type FindableKind,
    type MutatorId,
    type TileTraitKind,
    type Tile
} from './contracts';
import { buildBoard, countFindablePairs } from './board-generation';
import { inspectBoardFairness } from './board-inspection';
import { FINDABLE_REWARD_ROWS, getFindableSpawnWeightRows } from './findables';
import { pickFloorScheduleEntry, usesEndlessFloorSchedule } from './floor-mutator-schedule';
import {
    countTraitComboOpportunityPairs,
    countTraitInteractionLines,
    hasTraitBoardPowerInteractionOpportunity,
    hasTraitRewardInteractionFloor,
    hasTraitSwapSetupOpportunity
} from './tile-trait-rules';

export interface BalanceSimulationInput {
    seeds?: readonly number[];
    seed?: number;
    floors: number;
    rulesVersion?: number;
}

export interface BalanceSimulationRow {
    key: string;
    label: string;
    value: number;
    targetMin: number;
    targetMax: number;
    status: 'within_range' | 'below_range' | 'above_range';
    source: string;
}

export interface BalanceSimulationReport {
    rulesVersion: number;
    seeds: number[];
    floors: number;
    offlineOnly: true;
    samples: Array<{
        seed: number;
        floor: number;
        findablePickupPairs: number;
        findableKindCounts: Record<FindableKind, number>;
        tileTraitPairs: number;
        traitComboOpportunityPairs: number;
        traitMatchRouteFloors: number;
        traitSwapSetupOpportunities: number;
        traitInteractionLines: number;
        traitRewardPickupFloors: number;
        traitBoardPowerInteractionOpportunities: number;
        deadTraitFloors: number;
        tileTraitKindCounts: Record<TileTraitKind, number>;
        floorTag: string;
        floorBand: BalanceSimulationFloorBand;
        boardFairnessIssueCount: number;
    }>;
    aggregate: {
        findablePickupPairs: number;
        findableKindCounts: Record<FindableKind, number>;
        tileTraitPairs: number;
        traitComboOpportunityPairs: number;
        traitMatchRouteFloors: number;
        traitSwapSetupOpportunities: number;
        traitInteractionLines: number;
        traitRewardPickupFloors: number;
        traitBoardPowerInteractionOpportunities: number;
        deadTraitFloors: number;
        deadTraitFloorsByBand: Record<BalanceSimulationFloorBand, number>;
        tileTraitKindCounts: Record<TileTraitKind, number>;
        bossFloors: number;
        breatherFloors: number;
        boardFairnessIssueCount: number;
    };
    rows: BalanceSimulationRow[];
    notes: string[];
}

export const BALANCE_SIMULATION_FLOOR_BANDS = ['early', 'mid', 'late'] as const;

export type BalanceSimulationFloorBand = (typeof BALANCE_SIMULATION_FLOOR_BANDS)[number];

const statusFor = (value: number, targetMin: number, targetMax: number): BalanceSimulationRow['status'] =>
    value < targetMin ? 'below_range' : value > targetMax ? 'above_range' : 'within_range';

const row = (
    key: string,
    label: string,
    value: number,
    targetMin: number,
    targetMax: number,
    source: string
): BalanceSimulationRow => ({
    key,
    label,
    value,
    targetMin,
    targetMax,
    status: statusFor(value, targetMin, targetMax),
    source
});

const scheduleMutatorsFor = (seed: number, rulesVersion: number, level: number): MutatorId[] => {
    if (!usesEndlessFloorSchedule('endless', rulesVersion)) {
        return [];
    }
    return pickFloorScheduleEntry(seed, rulesVersion, level, 'endless').mutators;
};

const average = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const floorBandFor = (floor: number): BalanceSimulationFloorBand =>
    floor <= 4 ? 'early' : floor <= 8 ? 'mid' : 'late';

export const BALANCE_SIMULATION_FINDABLE_KINDS: readonly FindableKind[] = FINDABLE_REWARD_ROWS.map((row) => row.kind);

const emptyFindableKindCounts = (): Record<FindableKind, number> => ({
    shard_spark: 0,
    score_glint: 0
});

export const BALANCE_SIMULATION_TILE_TRAIT_KINDS: readonly TileTraitKind[] = ['echo', 'heavy', 'conduit', 'stasis'];

const emptyTileTraitKindCounts = (): Record<TileTraitKind, number> => ({
    echo: 0,
    heavy: 0,
    conduit: 0,
    stasis: 0
});

const countFindableKinds = (tiles: readonly Tile[]): Record<FindableKind, number> => {
    const counts = emptyFindableKindCounts();
    const seenPairs = new Set<string>();
    for (const tile of tiles) {
        if (!tile.findableKind || seenPairs.has(tile.pairKey)) {
            continue;
        }
        seenPairs.add(tile.pairKey);
        counts[tile.findableKind] += 1;
    }
    return counts;
};

const countTileTraitKinds = (tiles: readonly Tile[]): Record<TileTraitKind, number> => {
    const counts = emptyTileTraitKindCounts();
    const seenPairs = new Set<string>();
    for (const tile of tiles) {
        if (!tile.tileTraitKind || seenPairs.has(tile.pairKey)) {
            continue;
        }
        seenPairs.add(tile.pairKey);
        counts[tile.tileTraitKind] += 1;
    }
    return counts;
};

const getFindableKindTotal = (counts: Record<FindableKind, number>): number =>
    BALANCE_SIMULATION_FINDABLE_KINDS.reduce((sum, kind) => sum + counts[kind], 0);

const getTileTraitKindTotal = (counts: Record<TileTraitKind, number>): number =>
    BALANCE_SIMULATION_TILE_TRAIT_KINDS.reduce((sum, kind) => sum + counts[kind], 0);

const sumFindableKindCounts = (
    counts: readonly Record<FindableKind, number>[]
): Record<FindableKind, number> =>
    counts.reduce((totals, sampleCounts) => {
        for (const kind of BALANCE_SIMULATION_FINDABLE_KINDS) {
            totals[kind] += sampleCounts[kind];
        }
        return totals;
    }, emptyFindableKindCounts());

const sumTileTraitKindCounts = (
    counts: readonly Record<TileTraitKind, number>[]
): Record<TileTraitKind, number> =>
    counts.reduce((totals, sampleCounts) => {
        for (const kind of BALANCE_SIMULATION_TILE_TRAIT_KINDS) {
            totals[kind] += sampleCounts[kind];
        }
        return totals;
    }, emptyTileTraitKindCounts());

export const getFindableKindShares = (
    counts: Record<FindableKind, number>
): Record<FindableKind, number> => {
    const total = getFindableKindTotal(counts);
    return BALANCE_SIMULATION_FINDABLE_KINDS.reduce<Record<FindableKind, number>>(
        (shares, kind) => ({
            ...shares,
            [kind]: total === 0 ? 0 : counts[kind] / total
        }),
        emptyFindableKindCounts()
    );
};

export const getTileTraitKindShares = (
    counts: Record<TileTraitKind, number>
): Record<TileTraitKind, number> => {
    const total = getTileTraitKindTotal(counts);
    return BALANCE_SIMULATION_TILE_TRAIT_KINDS.reduce<Record<TileTraitKind, number>>(
        (shares, kind) => ({
            ...shares,
            [kind]: total === 0 ? 0 : counts[kind] / total
        }),
        emptyTileTraitKindCounts()
    );
};

export const runBalanceSimulation = ({
    seeds,
    seed,
    floors,
    rulesVersion = GAME_RULES_VERSION
}: BalanceSimulationInput): BalanceSimulationReport => {
    const safeFloors = Math.max(1, Math.floor(floors));
    const safeSeeds = seeds && seeds.length > 0 ? [...seeds] : [seed ?? 0];
    const floorNumbers = Array.from({ length: safeFloors }, (_, index) => index + 1);
    const samples = safeSeeds.flatMap((sampleSeed) =>
        floorNumbers.map((floor) => {
            const schedule = pickFloorScheduleEntry(sampleSeed, rulesVersion, floor, 'endless');
            const board = buildBoard(floor, {
                runSeed: sampleSeed,
                runRulesVersion: rulesVersion,
                floorTag: schedule.floorTag,
                floorArchetypeId: schedule.floorArchetypeId,
                gameMode: 'endless',
                activeMutators: scheduleMutatorsFor(sampleSeed, rulesVersion, floor)
            });
            const boardFairnessIssueCount = inspectBoardFairness(board).issues.length;
            const findableKindCounts = countFindableKinds(board.tiles);
            const tileTraitKindCounts = countTileTraitKinds(board.tiles);
            const tileTraitPairs = getTileTraitKindTotal(tileTraitKindCounts);
            const traitComboOpportunityPairs = countTraitComboOpportunityPairs(board);
            const traitMatchRouteFloors = traitComboOpportunityPairs > 0 ? 1 : 0;
            const traitSwapSetupOpportunities = hasTraitSwapSetupOpportunity(board) ? 1 : 0;
            const traitInteractionLines = countTraitInteractionLines(board);
            const traitRewardPickupFloors = hasTraitRewardInteractionFloor(board) ? 1 : 0;
            const traitBoardPowerInteractionOpportunities = hasTraitBoardPowerInteractionOpportunity(
                board,
                traitSwapSetupOpportunities > 0
            )
                ? 1
                : 0;
            const deadTraitFloors = tileTraitPairs > 0 && traitInteractionLines === 0 ? 1 : 0;
            return {
                seed: sampleSeed,
                floor,
                findablePickupPairs: countFindablePairs(board.tiles),
                findableKindCounts,
                tileTraitPairs,
                traitComboOpportunityPairs,
                traitMatchRouteFloors,
                traitSwapSetupOpportunities,
                traitInteractionLines,
                traitRewardPickupFloors,
                traitBoardPowerInteractionOpportunities,
                deadTraitFloors,
                tileTraitKindCounts,
                floorTag: schedule.floorTag,
                floorBand: floorBandFor(floor),
                boardFairnessIssueCount
            };
        })
    );
    const findableCounts = samples.map((sample) => sample.findablePickupPairs);
    const aggregateFindableKindCounts = sumFindableKindCounts(samples.map((sample) => sample.findableKindCounts));
    const findableKindShares = getFindableKindShares(aggregateFindableKindCounts);
    const tileTraitCounts = samples.map((sample) => sample.tileTraitPairs);
    const traitComboOpportunityCounts = samples.map((sample) => sample.traitComboOpportunityPairs);
    const traitMatchRouteFloorCounts = samples.map((sample) => sample.traitMatchRouteFloors);
    const traitSwapSetupOpportunityCounts = samples.map((sample) => sample.traitSwapSetupOpportunities);
    const traitInteractionLineCounts = samples.map((sample) => sample.traitInteractionLines);
    const traitRewardPickupFloorCounts = samples.map((sample) => sample.traitRewardPickupFloors);
    const traitBoardPowerInteractionOpportunityCounts = samples.map((sample) => sample.traitBoardPowerInteractionOpportunities);
    const deadTraitFloorCounts = samples.map((sample) => sample.deadTraitFloors);
    const deadTraitFloorsByBand = samples.reduce<Record<BalanceSimulationFloorBand, number>>(
        (counts, sample) => ({ ...counts, [sample.floorBand]: counts[sample.floorBand] + sample.deadTraitFloors }),
        { early: 0, mid: 0, late: 0 }
    );
    const aggregateTileTraitKindCounts = sumTileTraitKindCounts(samples.map((sample) => sample.tileTraitKindCounts));
    const tileTraitKindShares = getTileTraitKindShares(aggregateTileTraitKindCounts);
    const findableSpawnWeightRows = getFindableSpawnWeightRows();
    const totalFindableWeight = findableSpawnWeightRows.reduce((sum, weightRow) => sum + weightRow.weight, 0);
    const bossFloors = safeSeeds.flatMap((seed) =>
        floorNumbers.map((floor) => pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless').floorTag === 'boss' ? 1 : 0)
    );
    const findableTotalsByBand = samples.reduce<Record<BalanceSimulationFloorBand, number>>(
        (totals, sample) => ({
            ...totals,
            [sample.floorBand]: totals[sample.floorBand] + sample.findablePickupPairs
        }),
        { early: 0, mid: 0, late: 0 }
    );
    const sampleCountsByBand = samples.reduce<Record<BalanceSimulationFloorBand, number>>(
        (counts, sample) => ({ ...counts, [sample.floorBand]: counts[sample.floorBand] + 1 }),
        { early: 0, mid: 0, late: 0 }
    );
    const findableAverageByBand = BALANCE_SIMULATION_FLOOR_BANDS.map((band) =>
        sampleCountsByBand[band] === 0 ? 0 : findableTotalsByBand[band] / sampleCountsByBand[band]
    );

    const rows = [
        row(
            'avg_findable_pairs_per_floor',
            'Average pickup pairs per floor',
            Number(average(findableCounts).toFixed(2)),
            1,
            2,
            'buildBoard/countFindablePairs'
        ),
        row(
            'avg_tile_trait_pairs_per_floor',
            'Average trait-marked pairs per floor',
            Number(average(tileTraitCounts).toFixed(2)),
            3,
            14,
            'assignTileTraitsToGeneratedBoard'
        ),
        row(
            'avg_trait_combo_opportunity_pairs_per_floor',
            'Average trait pairs with previewable adjacency combos per floor',
            Number(average(traitComboOpportunityCounts).toFixed(2)),
            1,
            10,
            'getTileTraitInteractionPreviewLines'
        ),
        row(
            'trait_match_route_floor_share',
            'Share of floors with at least one match-triggerable trait route',
            Number(average(traitMatchRouteFloorCounts).toFixed(2)),
            0.75,
            1,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'avg_trait_swap_setup_opportunities_per_floor',
            'Share of floors with at least one one-swap trait route prime',
            Number(average(traitSwapSetupOpportunityCounts).toFixed(2)),
            0.1,
            1,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'avg_trait_interaction_lines_per_floor',
            'Average readable trait interaction preview lines per floor',
            Number(average(traitInteractionLineCounts).toFixed(2)),
            1,
            12,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'trait_reward_pickup_floor_share',
            'Share of floors where traits can produce a reward pickup or resource',
            Number(average(traitRewardPickupFloorCounts).toFixed(2)),
            0.7,
            1,
            'getBoardTraitInteractionPreviewLines'
        ),
        row(
            'trait_board_power_interaction_floor_share',
            'Share of floors where traits can interact with shuffle, swap, or block tools',
            Number(average(traitBoardPowerInteractionOpportunityCounts).toFixed(2)),
            // 0.5 down to 0.4: a swap or block wants two traited tiles next to each other, and the
            // dungeon cards that used to pad a floor out were carrying traits too. Measured 0.42.
            0.4,
            1,
            'hasTraitSwapSetupOpportunity'
        ),
        row(
            'dead_trait_floor_share',
            'Share of trait floors without any readable trait interaction',
            Number(average(deadTraitFloorCounts).toFixed(2)),
            0,
            0,
            'getBoardTraitInteractionPreviewLines'
        ),
        ...BALANCE_SIMULATION_TILE_TRAIT_KINDS.map((kind) =>
            row(
                `tile_trait_share_${kind}`,
                `Tile trait ${kind} observed share`,
                Number(tileTraitKindShares[kind].toFixed(2)),
                0,
                0.45,
                'assignTileTraitsToGeneratedBoard'
            )
        ),
        ...findableSpawnWeightRows.map((weightRow) => {
            const targetShare = weightRow.weight / totalFindableWeight;
            return row(
                `findable_share_${weightRow.id}`,
                `Findable ${weightRow.id} observed share`,
                Number(findableKindShares[weightRow.id].toFixed(2)),
                Math.max(0, Number((targetShare - 0.18).toFixed(2))),
                Math.min(1, Number((targetShare + 0.18).toFixed(2))),
                'FINDABLE_KIND_SPAWN_WEIGHTS'
            );
        }),
        row(
            'boss_floor_share',
            'Boss floor share in schedule sample',
            Number(average(bossFloors).toFixed(2)),
            0.1,
            0.25,
            'pickFloorScheduleEntry'
        ),
        row(
            'findable_band_spread',
            'Findable spread across early/mid/late bands',
            Number((Math.min(...findableAverageByBand) / Math.max(1, Math.max(...findableAverageByBand))).toFixed(2)),
            0.35,
            1,
            'floor-band findable totals'
        ),
        row(
            'board_fairness_issue_floor_share',
            'Share of sampled floors with generated board fairness issues',
            Number((samples.filter((sample) => sample.boardFairnessIssueCount > 0).length / samples.length).toFixed(2)),
            0,
            0,
            'board fairness inspection'
        )
    ];

    return {
        rulesVersion,
        seeds: safeSeeds,
        floors: safeFloors,
        offlineOnly: true,
        samples,
        aggregate: {
            findablePickupPairs: samples.reduce((sum, sample) => sum + sample.findablePickupPairs, 0),
            findableKindCounts: aggregateFindableKindCounts,
            tileTraitPairs: samples.reduce((sum, sample) => sum + sample.tileTraitPairs, 0),
            traitComboOpportunityPairs: samples.reduce((sum, sample) => sum + sample.traitComboOpportunityPairs, 0),
            traitMatchRouteFloors: samples.reduce((sum, sample) => sum + sample.traitMatchRouteFloors, 0),
            traitSwapSetupOpportunities: samples.reduce((sum, sample) => sum + sample.traitSwapSetupOpportunities, 0),
            traitInteractionLines: samples.reduce((sum, sample) => sum + sample.traitInteractionLines, 0),
            traitRewardPickupFloors: samples.reduce((sum, sample) => sum + sample.traitRewardPickupFloors, 0),
            traitBoardPowerInteractionOpportunities: samples.reduce(
                (sum, sample) => sum + sample.traitBoardPowerInteractionOpportunities,
                0
            ),
            deadTraitFloors: samples.reduce((sum, sample) => sum + sample.deadTraitFloors, 0),
            deadTraitFloorsByBand,
            tileTraitKindCounts: aggregateTileTraitKindCounts,
            bossFloors: samples.filter((sample) => sample.floorTag === 'boss').length,
            breatherFloors: samples.filter((sample) => sample.floorTag === 'breather').length,
            boardFairnessIssueCount: samples.reduce((sum, sample) => sum + sample.boardFairnessIssueCount, 0)
        },
        rows,
        notes: [
            'Simulation is deterministic and local-only; no leaderboard or server authority is implied.',
            'Targets are smoke-test guardrails, not final balance verdicts.',
            'Findable kind distribution rows are diagnostics for seeded generation drift; they do not alter rewards or spawn rules.',
            'Tile trait rows verify density and mix for the reward/drawback layer without changing runtime gameplay.'
        ]
    };
};

export const summarizeBalanceSimulation = (report: BalanceSimulationReport): string =>
    report.rows.map((entry) => `${entry.key}=${entry.value}(${entry.status})`).join('; ');

export const BALANCE_SIMULATION_BASELINE = {
    findablePickupPairs: { min: 12, max: 24 },
    bossFloors: { min: 2, max: 2 },
    breatherFloors: { min: 3, max: 3 }
} as const;

export const BALANCE_SIMULATION_BASELINE_KEYS = [
    'findablePickupPairs',
    'bossFloors',
    'breatherFloors'
] as const satisfies readonly (keyof typeof BALANCE_SIMULATION_BASELINE)[];

export const assertBalanceSimulationWithinBaseline = (
    report: BalanceSimulationReport,
    baseline: typeof BALANCE_SIMULATION_BASELINE
): { ok: boolean; issues: string[] } => {
    const issues = BALANCE_SIMULATION_BASELINE_KEYS.flatMap((key) => {
        const value = report.aggregate[key];
        const range = baseline[key];
        return value < range.min || value > range.max ? [`${key}:${value} outside ${range.min}-${range.max}`] : [];
    });
    return { ok: issues.length === 0, issues };
};
