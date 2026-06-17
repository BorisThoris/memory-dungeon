import {
    GAME_RULES_VERSION,
    type BoardState,
    type DungeonRunNodeKind,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId,
    type RouteNodeType,
    type Tile
} from './contracts';
import { buildBoard, type BuildBoardOptions } from './board-build-rules';
import { inspectBoardFairness, type BoardFairnessIssue } from './board-inspection';
import { EXIT_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';

export type SoftlockContractCoverageKey =
    | 'locks'
    | 'shops'
    | 'keys'
    | 'levers'
    | 'traits'
    | 'exits'
    | 'hazards'
    | 'enemies'
    | 'bosses'
    | 'finalPairStates';

export interface SoftlockGeneratorScenario {
    id: string;
    label: string;
    seeds: readonly number[];
    floors: readonly number[];
    optionsForFloor: (input: { seed: number; floor: number }) => BuildBoardOptions;
}

export interface SoftlockGeneratorFailure {
    scenarioId: string;
    scenarioLabel: string;
    seed: number;
    floor: number;
    projection: 'generated' | 'final_pair';
    issueCodes: string[];
    issues: BoardFairnessIssue[];
    boardSummary: string;
}

export interface SoftlockGeneratorContractResult {
    checkedBoards: number;
    failures: SoftlockGeneratorFailure[];
    coverage: Record<SoftlockContractCoverageKey, number>;
}

const COVERAGE_KEYS: readonly SoftlockContractCoverageKey[] = [
    'locks',
    'shops',
    'keys',
    'levers',
    'traits',
    'exits',
    'hazards',
    'enemies',
    'bosses',
    'finalPairStates'
];

const ROUTE_TYPES: readonly RouteNodeType[] = ['safe', 'greed', 'mystery'];

const coverageTemplate = (): Record<SoftlockContractCoverageKey, number> =>
    Object.fromEntries(COVERAGE_KEYS.map((key) => [key, 0])) as Record<SoftlockContractCoverageKey, number>;

const boardSummary = (board: BoardState): string =>
    [
        `level=${board.level}`,
        `pairs=${board.pairCount}`,
        `floorTag=${board.floorTag ?? 'normal'}`,
        `archetype=${board.floorArchetypeId ?? 'none'}`,
        `objective=${board.dungeonObjectiveId ?? 'find_exit'}`,
        `exitLock=${board.dungeonExitLockKind ?? 'none'}`,
        `boss=${board.dungeonBossId ?? 'none'}`,
        `hazards=${board.enemyHazards?.filter((hazard) => hazard.state !== 'defeated').length ?? 0}`
    ].join(' ');

const realPairKeys = (board: BoardState): string[] => [
    ...new Set(board.tiles.filter((tile) => !isSingletonUtilityPairKey(tile.pairKey)).map((tile) => tile.pairKey))
];

const tileIsCleared = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const countMatchedPairs = (tiles: readonly Tile[]): number =>
    realPairKeys({ tiles } as BoardState).filter((pairKey) =>
        tiles.filter((tile) => tile.pairKey === pairKey).every(tileIsCleared)
    ).length;

const pickFinalPairKey = (board: BoardState): string | null => {
    const dungeonPair =
        board.tiles.find((tile) => !isSingletonUtilityPairKey(tile.pairKey) && tile.dungeonCardKind != null)?.pairKey ?? null;
    if (dungeonPair) {
        return dungeonPair;
    }
    return realPairKeys(board)[0] ?? null;
};

export const createFinalPairFairnessProjection = (board: BoardState): BoardState | null => {
    const remainingPairKey = pickFinalPairKey(board);
    if (!remainingPairKey) {
        return null;
    }
    const activeTileIds = new Set<string>();
    const tiles = board.tiles.map((tile) => {
        if (tile.pairKey === remainingPairKey || isSingletonUtilityPairKey(tile.pairKey)) {
            activeTileIds.add(tile.id);
            return tile.state === 'removed' ? { ...tile, state: 'hidden' as const } : { ...tile, state: 'hidden' as const };
        }
        return { ...tile, state: 'matched' as const };
    });
    const exitLockKind = board.dungeonExitLockKind ?? 'none';
    const needsKey = exitLockKind !== 'none' && exitLockKind !== 'lever';
    const needsLever = exitLockKind === 'lever';
    return {
        ...board,
        tiles,
        flippedTileIds: [],
        matchedPairs: countMatchedPairs(tiles),
        dungeonKeysHeld: needsKey ? Math.max(board.dungeonKeysHeld ?? 0, 1) : board.dungeonKeysHeld,
        dungeonLeverCount: needsLever
            ? Math.max(board.dungeonLeverCount ?? 0, board.dungeonExitRequiredLeverCount ?? 0)
            : board.dungeonLeverCount,
        enemyHazards: board.enemyHazards?.map((hazard) =>
            activeTileIds.has(hazard.currentTileId) && activeTileIds.has(hazard.nextTileId)
                ? hazard
                : { ...hazard, state: 'defeated' as const, hp: 0 }
        )
    };
};

const addCoverage = (coverage: Record<SoftlockContractCoverageKey, number>, board: BoardState, projection: 'generated' | 'final_pair'): void => {
    const lockKind = board.dungeonExitLockKind ?? 'none';
    if (lockKind !== 'none') coverage.locks += 1;
    if (board.dungeonShopTileId || board.tiles.some((tile) => tile.dungeonCardKind === 'shop')) coverage.shops += 1;
    if (
        board.tiles.some((tile) => tile.dungeonCardKind === 'key' || tile.dungeonCardEffectId === 'room_key_cache') ||
        (board.dungeonKeysHeld ?? 0) > 0
    ) {
        coverage.keys += 1;
    }
    if (board.tiles.some((tile) => tile.dungeonCardKind === 'lever') || (board.dungeonLeverCount ?? 0) > 0) {
        coverage.levers += 1;
    }
    if (board.tiles.some((tile) => tile.tileTraitKind != null)) coverage.traits += 1;
    if (board.tiles.some((tile) => tile.pairKey === EXIT_PAIR_KEY || tile.dungeonCardKind === 'exit')) coverage.exits += 1;
    if (board.tiles.some((tile) => tile.tileHazardKind != null) || (board.enemyHazards?.length ?? 0) > 0) coverage.hazards += 1;
    if (board.tiles.some((tile) => tile.dungeonCardKind === 'enemy') || (board.enemyHazards?.length ?? 0) > 0) {
        coverage.enemies += 1;
    }
    if (board.dungeonBossId != null || board.tiles.some((tile) => tile.dungeonBossId != null)) coverage.bosses += 1;
    if (projection === 'final_pair') coverage.finalPairStates += 1;
};

const recordInspection = (
    result: SoftlockGeneratorContractResult,
    scenario: SoftlockGeneratorScenario,
    seed: number,
    floor: number,
    projection: 'generated' | 'final_pair',
    board: BoardState
): void => {
    result.checkedBoards += 1;
    addCoverage(result.coverage, board, projection);
    const report = inspectBoardFairness(board);
    if (report.issues.length > 0 || !report.hasCompletionRoute) {
        result.failures.push({
            scenarioId: scenario.id,
            scenarioLabel: scenario.label,
            seed,
            floor,
            projection,
            issueCodes: report.issues.map((issue) => issue.code),
            issues: report.issues,
            boardSummary: boardSummary(board)
        });
    }
};

const scenarioOptions = (
    seed: number,
    floor: number,
    overrides: Partial<BuildBoardOptions> = {}
): BuildBoardOptions => ({
    runSeed: seed,
    runRulesVersion: GAME_RULES_VERSION,
    gameMode: 'endless',
    ...overrides
});

const scheduledTag = (floor: number): FloorTag => (floor === 7 || floor === 9 || floor === 12 ? 'boss' : floor === 10 ? 'breather' : 'normal');
const scheduledArchetype = (floor: number): FloorArchetypeId | null =>
    floor === 4
        ? 'shadow_read'
        : floor === 7
          ? 'trap_hall'
          : floor === 9
            ? 'rush_recall'
            : floor === 10
              ? 'treasure_gallery'
              : null;

const scheduledMutators = (floor: number): MutatorId[] =>
    floor === 7 ? ['glass_floor', 'sticky_fingers'] : floor === 9 ? ['short_memorize', 'wide_recall'] : [];

const nodeKindForFloor = (floor: number): DungeonRunNodeKind | null =>
    floor === 3 ? 'shop' : floor === 5 ? 'elite' : floor === 7 ? 'trap' : floor === 9 || floor === 12 ? 'boss' : null;

export const DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS: readonly SoftlockGeneratorScenario[] = [
    {
        id: 'endless_cycle',
        label: 'Endless cycle floors with authored pressure',
        seeds: [1, 42_001, 867_5309],
        floors: Array.from({ length: 12 }, (_, index) => index + 1),
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                floorTag: scheduledTag(floor),
                floorArchetypeId: scheduledArchetype(floor),
                activeMutators: scheduledMutators(floor),
                dungeonNodeKind: nodeKindForFloor(floor),
                cycleFloor: floor
            })
    },
    {
        id: 'route_pressure',
        label: 'Route-card pressure floors',
        seeds: [70_101, 70_202],
        floors: [2, 4, 6, 8],
        optionsForFloor: ({ seed, floor }) => {
            const routeType = ROUTE_TYPES[(seed + floor) % ROUTE_TYPES.length]!;
            return scenarioOptions(seed, floor, {
                routeCardPlan: {
                    choiceId: `contract:${routeType}:${seed}:${floor}`,
                    routeType,
                    sourceLevel: Math.max(1, floor - 1),
                    targetLevel: floor
                }
            });
        }
    },
    {
        id: 'boss_pressure',
        label: 'Boss identity pressure floors',
        seeds: [90_001, 90_002, 90_003],
        floors: [7, 9, 12],
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                floorTag: 'boss',
                dungeonNodeKind: 'boss',
                floorArchetypeId: floor === 9 ? 'rush_recall' : null,
                activeMutators: floor === 9 ? ['short_memorize', 'wide_recall'] : []
            })
    },
    {
        id: 'trait_and_hazard_pressure',
        label: 'Trait, hazard, and utility overlap floors',
        seeds: [120_011, 120_022],
        floors: [3, 5, 7, 9, 11],
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                floorTag: floor === 7 ? 'boss' : 'normal',
                floorArchetypeId: floor === 7 ? 'trap_hall' : floor === 9 ? 'spotlight_hunt' : 'shadow_read',
                activeMutators: ['shifting_spotlight'],
                dungeonNodeKind: floor === 5 ? 'elite' : floor === 7 ? 'boss' : 'combat',
                relicIds: ['region_shuffle_free_first', 'peek_charge_plus_one']
            })
    }
];

export const runSoftlockGeneratorContract = (
    scenarios: readonly SoftlockGeneratorScenario[] = DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS
): SoftlockGeneratorContractResult => {
    const result: SoftlockGeneratorContractResult = {
        checkedBoards: 0,
        failures: [],
        coverage: coverageTemplate()
    };

    for (const scenario of scenarios) {
        for (const seed of scenario.seeds) {
            for (const floor of scenario.floors) {
                const board = buildBoard(floor, scenario.optionsForFloor({ seed, floor }));
                recordInspection(result, scenario, seed, floor, 'generated', board);
                const finalPair = createFinalPairFairnessProjection(board);
                if (finalPair) {
                    recordInspection(result, scenario, seed, floor, 'final_pair', finalPair);
                }
            }
        }
    }

    return result;
};

export const formatSoftlockGeneratorFailure = (failure: SoftlockGeneratorFailure): string =>
    [
        `[${failure.scenarioId}] ${failure.scenarioLabel}`,
        `seed=${failure.seed}`,
        `floor=${failure.floor}`,
        `projection=${failure.projection}`,
        failure.boardSummary,
        `issues=${failure.issueCodes.join(',') || 'completion_route_missing'}`
    ].join(' | ');
