import {
    GAME_RULES_VERSION,
    type BoardState,
    type DungeonRunNodeKind,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId,
    type RunState,
    type RouteNodeType,
    type Tile
} from './contracts';
import { buildBoard, type BuildBoardOptions } from './board-build-rules';
import { countFindablePairs } from './board-generation';
import {
    countReachableExitKeySources,
    getEffectivePrimaryExitLock,
    getWildTileIdFromBoard,
    inspectBoardFairness,
    inspectRunFairness,
    boardHasActionableProgressionPair,
    boardHasGlassDecoy,
    type BoardFairnessIssue
} from './board-inspection';
import { advanceToNextLevel } from './next-floor-transition-rules';
import {
    solveRunByExhaustingPlayablePairsWithTrace,
    type PlaythroughSolverTrace
} from './playthrough-solver';
import { EXIT_PAIR_KEY, isSingletonUtilityPairKey } from './tile-identity';
import { createNewRun } from './run-creation-rules';
import { createDungeonRunMapState, inspectDungeonRunMapProgression } from './run-map';
import { getDungeonKeyTotal } from './run-inventory';
import { getRunShopStockPlan, SHOP_KEY_ITEM_BY_KIND } from './shop-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { activeEnemyHazardsForBoard, defeatEnemyHazardsOnClearedTiles, enemyHazardsForBoard } from './enemy-hazard-board-rules';
import {
    formatDungeonBoardTopologyIssue,
    formatDungeonRunMapTopologyIssue,
    inspectDungeonBoardTopology,
    inspectDungeonRunMapTopology
} from './dungeon-topology';
import { getBoardTraitInteractionPreviewLines } from './tile-trait-rules';
import { getTraitRouteObjectiveSeed } from './trait-route-objectives';

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
    | 'traitInteractions'
    | 'traitRouteObjectives'
    | 'topology'
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
    projection: 'generated' | 'final_pair' | 'cleared_board' | 'playable_clear' | 'next_floor' | 'shop_stock';
    issueCodes: string[];
    issueDetails: string[];
    issues: BoardFairnessIssue[];
    boardSummary: string;
}

export interface SoftlockGeneratorContractResult {
    checkedBoards: number;
    checkedPlayableBoards: number;
    checkedNextFloorTransitions: number;
    checkedShopPlans: number;
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
    'traitInteractions',
    'traitRouteObjectives',
    'topology',
    'finalPairStates'
];

const ROUTE_TYPES: readonly RouteNodeType[] = ['safe', 'greed', 'mystery'];
const DEFAULT_ROUTE_TYPE: RouteNodeType = 'safe';

const coverageTemplate = (): Record<SoftlockContractCoverageKey, number> =>
    Object.fromEntries(COVERAGE_KEYS.map((key) => [key, 0])) as Record<SoftlockContractCoverageKey, number>;

const boardSummary = (board: BoardState): string => {
    const effectiveLock = getEffectivePrimaryExitLock({ board });
    return [
        `level=${board.level}`,
        `pairs=${board.pairCount}`,
        `floorTag=${board.floorTag ?? 'normal'}`,
        `archetype=${board.floorArchetypeId ?? 'none'}`,
        `objective=${board.dungeonObjectiveId ?? 'find_exit'}`,
        `exitLock=${effectiveLock.lockKind}`,
        `boss=${board.dungeonBossId ?? 'none'}`,
        `hazards=${activeEnemyHazardsForBoard(board).length}`
    ].join(' ');
};

const formatIssueDetail = (issue: BoardFairnessIssue): string => {
    const parts = [`${issue.code}: ${issue.message}`];
    if (issue.pairKey) {
        parts.push(`pair=${issue.pairKey}`);
    }
    if (issue.tileIds && issue.tileIds.length > 0) {
        parts.push(`tiles=${issue.tileIds.join(',')}`);
    }
    return parts.join(' ');
};

const realPairKeys = (board: BoardState): string[] => [
    ...new Set(board.tiles.filter((tile) => !isSingletonUtilityPairKey(tile.pairKey)).map((tile) => tile.pairKey))
];

const tileIsCleared = (tile: Tile): boolean => tile.state === 'matched' || tile.state === 'removed';

const countMatchedPairs = (tiles: readonly Tile[]): number =>
    realPairKeys({ tiles } as BoardState).filter((pairKey) =>
        tiles.filter((tile) => tile.pairKey === pairKey).every(tileIsCleared)
    ).length;

export const createGeneratedBoardSolverRun = (
    board: BoardState,
    seed: number,
    rulesVersion = GAME_RULES_VERSION
): RunState => {
    const traitRouteObjective = getTraitRouteObjectiveSeed(board);
    return {
        ...createNewRun(0, { runSeed: seed, runRulesVersionOverride: rulesVersion }),
        board,
        status: 'playing',
        dungeonRun: createDungeonRunMapState(seed, rulesVersion, board.level),
        wildTileId: getWildTileIdFromBoard(board),
        glassDecoyActiveThisFloor: boardHasGlassDecoy(board),
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        traitRouteObjectiveProgressThisFloor: 0,
        traitRouteObjectiveRequiredThisFloor: traitRouteObjective?.required ?? 0,
        traitRouteObjectiveCompletedThisFloor: false,
        traitRouteObjectiveRewardClaimedThisFloor: false,
        traitRouteObjectiveRewardTextThisFloor: null,
        traitRouteObjectiveTriggeredTagsThisFloor: []
    };
};

export const solveGeneratedBoardByExhaustingPairs = (board: BoardState, seed: number): RunState => {
    const run = createGeneratedBoardSolverRun(board, seed);
    return solveRunByExhaustingPlayablePairsWithTrace(run).run;
};

export const createShopStockInspectionRun = (run: RunState, board: BoardState): RunState => ({
    ...run,
    status: 'playing',
    shopRerolls: 0,
    stats: {
        ...normalizeSessionStats(run.stats),
        highestLevel: Math.max(1, board.level)
    }
});

const solveGeneratedBoardByExhaustingPairsWithTrace = (board: BoardState, seed: number): PlaythroughSolverTrace => {
    return solveRunByExhaustingPlayablePairsWithTrace(createGeneratedBoardSolverRun(board, seed));
};

const pickFinalPairKey = (board: BoardState): string | null => {
    const dungeonPair =
        board.tiles.find((tile) => !isSingletonUtilityPairKey(tile.pairKey) && tile.dungeonCardKind != null)?.pairKey ?? null;
    if (dungeonPair) {
        return dungeonPair;
    }
    return realPairKeys(board)[0] ?? null;
};

const nonNegativeSoftlockContractCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const projectionExitResourceState = (
    board: BoardState
): Pick<BoardState, 'dungeonKeysHeld' | 'dungeonKeysHeldByKind' | 'dungeonLeverCount'> => {
    const lock = getEffectivePrimaryExitLock({ board });
    const needsKey =
        lock.lockKind !== 'none' &&
        lock.lockKind !== 'lever' &&
        countReachableExitKeySources(board, lock.lockKind) > 0;
    const needsLever = lock.lockKind === 'lever';
    const dungeonKeysHeld = needsKey ? Math.max(nonNegativeSoftlockContractCount(board.dungeonKeysHeld), 1) : board.dungeonKeysHeld;
    const dungeonKeysHeldByKind =
        needsKey && lock.lockKind !== 'none' && lock.lockKind !== 'lever'
            ? {
                  ...(board.dungeonKeysHeldByKind ?? {}),
                  [lock.lockKind]: Math.max(nonNegativeSoftlockContractCount(board.dungeonKeysHeldByKind?.[lock.lockKind]), 1)
              }
            : board.dungeonKeysHeldByKind;
    return {
        dungeonKeysHeld,
        dungeonKeysHeldByKind,
        dungeonLeverCount: needsLever
            ? Math.max(nonNegativeSoftlockContractCount(board.dungeonLeverCount), nonNegativeSoftlockContractCount(lock.requiredLeverCount))
            : board.dungeonLeverCount
    };
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
    return {
        ...board,
        tiles,
        flippedTileIds: [],
        matchedPairs: countMatchedPairs(tiles),
        ...projectionExitResourceState(board),
        enemyHazards: enemyHazardsForBoard(board).map((hazard) =>
            activeTileIds.has(hazard.currentTileId) && activeTileIds.has(hazard.nextTileId)
                ? hazard
                : { ...hazard, state: 'defeated' as const, hp: 0 }
        )
    };
};

export const createClearedBoardFairnessProjection = (board: BoardState): BoardState => {
    const tiles = board.tiles.map((tile) =>
        isSingletonUtilityPairKey(tile.pairKey) ? { ...tile } : { ...tile, state: 'matched' as const }
    );
    return defeatEnemyHazardsOnClearedTiles({
        ...board,
        tiles,
        enemyHazards: enemyHazardsForBoard(board),
        flippedTileIds: [],
        matchedPairs: countMatchedPairs(tiles),
        dungeonExitActivated: board.dungeonExitTileId != null ? true : board.dungeonExitActivated,
        ...projectionExitResourceState(board)
    });
};

const addCoverage = (
    coverage: Record<SoftlockContractCoverageKey, number>,
    board: BoardState,
    projection: 'generated' | 'final_pair' | 'cleared_board',
    topologyReport: ReturnType<typeof inspectDungeonBoardTopology>
): void => {
    const lockKind = getEffectivePrimaryExitLock({ board }).lockKind;
    if (lockKind !== 'none') coverage.locks += 1;
    if (board.dungeonShopTileId || board.tiles.some((tile) => tile.dungeonCardKind === 'shop')) coverage.shops += 1;
    if (
        board.tiles.some((tile) => tile.dungeonCardKind === 'key' || tile.dungeonCardEffectId === 'room_key_cache') ||
        nonNegativeSoftlockContractCount(board.dungeonKeysHeld) > 0 ||
        getDungeonKeyTotal(board.dungeonKeysHeldByKind) > 0
    ) {
        coverage.keys += 1;
    }
    if (board.tiles.some((tile) => tile.dungeonCardKind === 'lever') || nonNegativeSoftlockContractCount(board.dungeonLeverCount) > 0) {
        coverage.levers += 1;
    }
    if (board.tiles.some((tile) => tile.tileTraitKind != null)) coverage.traits += 1;
    if (board.tiles.some((tile) => tile.pairKey === EXIT_PAIR_KEY || tile.dungeonCardKind === 'exit')) coverage.exits += 1;
    const enemyHazardCount = enemyHazardsForBoard(board).length;
    if (board.tiles.some((tile) => tile.tileHazardKind != null) || enemyHazardCount > 0) coverage.hazards += 1;
    if (board.tiles.some((tile) => tile.dungeonCardKind === 'enemy') || enemyHazardCount > 0) {
        coverage.enemies += 1;
    }
    if (board.dungeonBossId != null || board.tiles.some((tile) => tile.dungeonBossId != null)) coverage.bosses += 1;
    if (getBoardTraitInteractionPreviewLines(board).length > 0) coverage.traitInteractions += 1;
    if (getTraitRouteObjectiveSeed(board) != null) coverage.traitRouteObjectives += 1;
    if (topologyReport.graph.order > 0) coverage.topology += 1;
    if (projection === 'final_pair' || projection === 'cleared_board') coverage.finalPairStates += 1;
};

const boardNeedsKeyInsurance = (board: BoardState): boolean =>
    (() => {
        const lock = getEffectivePrimaryExitLock({ board });
        return (
            lock.lockKind !== 'none' &&
            lock.lockKind !== 'lever' &&
            countReachableExitKeySources(board, lock.lockKind) < 1
        );
    })();

const requiredShopInsuranceItemForBoard = (board: BoardState) => {
    const lock = getEffectivePrimaryExitLock({ board });
    return lock.lockKind !== 'none' && lock.lockKind !== 'lever' ? SHOP_KEY_ITEM_BY_KIND[lock.lockKind] : null;
};

const recordInspection = (
    result: SoftlockGeneratorContractResult,
    scenario: SoftlockGeneratorScenario,
    seed: number,
    floor: number,
    projection: 'generated' | 'final_pair' | 'cleared_board',
    board: BoardState
): void => {
    result.checkedBoards += 1;
    const report = inspectBoardFairness(board);
    const topologyReport = inspectDungeonBoardTopology(board);
    addCoverage(result.coverage, board, projection, topologyReport);
    const traitPairCount = new Set(
        board.tiles
            .filter((tile) => tile.tileTraitKind != null && tile.state !== 'matched' && tile.state !== 'removed')
            .map((tile) => tile.pairKey)
    ).size;
    const generatedTraitInteractionIssues: BoardFairnessIssue[] =
        projection === 'generated' && traitPairCount >= 2 && getBoardTraitInteractionPreviewLines(board).length === 0
            ? [
                  {
                      code: 'trait_interaction_missing',
                      message: `Generated trait board has ${traitPairCount} trait pair(s), but no adjacent trait interaction preview.`
                  }
              ]
            : [];
    const traitRouteObjective = projection === 'generated' ? getTraitRouteObjectiveSeed(board) : null;
    const matchTraitInteractionLines = traitRouteObjective
        ? getBoardTraitInteractionPreviewLines(board, 'match')
        : [];
    const traitRouteObjectiveIssues: BoardFairnessIssue[] =
        traitRouteObjective && traitRouteObjective.required > matchTraitInteractionLines.length
            ? [
                  {
                      code: 'trait_route_objective_unreachable',
                      message: `Trait route objective requires ${traitRouteObjective.required} match interaction(s), but only ${matchTraitInteractionLines.length} are triggerable.`
                  }
              ]
            : [];
    const completionRouteIssues: BoardFairnessIssue[] = report.hasCompletionRoute
        ? []
        : [
              {
                  code: 'completion_route_missing',
                  message: 'Board has no structural completion route.'
              }
          ];
    const topologyIssues: BoardFairnessIssue[] = topologyReport.issues
        .filter((issue) => {
            if (issue.code === 'topology_exit_lock_source_missing' || issue.code === 'topology_completion_route_missing') {
                return !boardHasActionableProgressionPair(board);
            }
            if (issue.code === 'topology_boss_source_missing') {
                return projection === 'generated';
            }
            return true;
        })
        .map((issue) => ({
            code:
                issue.code === 'topology_boss_source_missing'
                    ? ('dungeon_objective_unreachable' as const)
                    : ('exit_lock_unreachable' as const),
            message: `Topology validation: ${formatDungeonBoardTopologyIssue(issue, topologyReport)}`,
            tileIds: issue.tileIds
        }));
    const issues = [
        ...report.issues,
        ...completionRouteIssues,
        ...topologyIssues,
        ...generatedTraitInteractionIssues,
        ...traitRouteObjectiveIssues
    ];
    if (issues.length > 0) {
        result.failures.push({
            scenarioId: scenario.id,
            scenarioLabel: scenario.label,
            seed,
            floor,
            projection,
            issueCodes: issues.map((issue) => issue.code),
            issueDetails: issues.map(formatIssueDetail),
            issues,
            boardSummary: boardSummary(board)
        });
    }
};

const recordShopStockInspection = (
    result: SoftlockGeneratorContractResult,
    scenario: SoftlockGeneratorScenario,
    seed: number,
    floor: number,
    board: BoardState
): void => {
    if (!boardNeedsKeyInsurance(board)) {
        return;
    }
    result.checkedShopPlans += 1;
    const run = createGeneratedBoardSolverRun(board, seed);
    const plan = getRunShopStockPlan(createShopStockInspectionRun(run, board));
    const requiredKeyItem = requiredShopInsuranceItemForBoard(board);
    if ((requiredKeyItem && plan.itemIds.includes(requiredKeyItem)) || plan.itemIds.includes('master_key')) {
        return;
    }

    const issue: BoardFairnessIssue = {
        code: 'exit_lock_unreachable',
        message: `Locked exit shop stock lacks ${requiredKeyItem ?? 'matching_key'} or master key insurance; stock=${
            plan.itemIds.join(',') || 'empty'
        }.`,
        tileIds: board.dungeonExitTileId ? [board.dungeonExitTileId] : undefined
    };
    result.failures.push({
        scenarioId: scenario.id,
        scenarioLabel: scenario.label,
        seed,
        floor,
        projection: 'shop_stock',
        issueCodes: [issue.code],
        issueDetails: [formatIssueDetail(issue)],
        issues: [issue],
        boardSummary: boardSummary(board)
    });
};

const recordPlayableClearInspection = (
    result: SoftlockGeneratorContractResult,
    scenario: SoftlockGeneratorScenario,
    seed: number,
    floor: number,
    board: BoardState
): void => {
    result.checkedPlayableBoards += 1;
    const trace = solveGeneratedBoardByExhaustingPairsWithTrace(board, seed);
    const solved = trace.run;
    const solvedBoard = solved.board ?? board;
    const report = inspectBoardFairness(solvedBoard, {
        dungeonKeys: solved.dungeonKeys,
        dungeonMasterKeys: solved.dungeonMasterKeys
    });
    const topologyReport = inspectDungeonBoardTopology(solvedBoard, {
        dungeonKeys: solved.dungeonKeys,
        dungeonMasterKeys: solved.dungeonMasterKeys
    });
    const topologyIssues: BoardFairnessIssue[] = topologyReport.issues.map((issue) => ({
        code:
            issue.code === 'topology_boss_source_missing'
                ? ('dungeon_objective_unreachable' as const)
                : ('exit_lock_unreachable' as const),
        message: `Solved-run topology validation: ${formatDungeonBoardTopologyIssue(issue, topologyReport)}`,
        tileIds: issue.tileIds
    }));
    const staleEnemyHazards =
        solved.status === 'levelComplete'
            ? enemyHazardsForBoard(solved.board).filter((hazard) => hazard.state !== 'defeated')
            : [];
    if (
        solved.status === 'levelComplete' &&
        report.issues.length === 0 &&
        topologyIssues.length === 0 &&
        staleEnemyHazards.length === 0
    ) {
        result.checkedNextFloorTransitions += 1;
        const next = advanceToNextLevel(solved);
        const nextReport = inspectRunFairness(next);
        const routeReport = inspectDungeonRunMapProgression(next.dungeonRun);
        const routeTopologyReport = inspectDungeonRunMapTopology(next.dungeonRun);
        if (
            next.status === 'memorize' &&
            next.board?.level === floor + 1 &&
            next.dungeonRun.currentFloor === next.board.level &&
            nextReport.issues.length === 0 &&
            routeReport.hasLegalProgressionPath &&
            routeReport.issues.length === 0 &&
            routeTopologyReport.issues.length === 0
        ) {
            return;
        }

        const nextIssue: BoardFairnessIssue = {
            code: 'completion_route_missing',
            message: `Next-floor transition ended with status=${next.status}, boardLevel=${next.board?.level ?? 'none'}, dungeonFloor=${next.dungeonRun.currentFloor}, routeLegal=${routeReport.hasLegalProgressionPath}; expected fair memorize run for level ${floor + 1}.`
        };
        const routeIssues: BoardFairnessIssue[] = routeReport.issues.map((issue) => ({
            code: 'completion_route_missing',
            message: `${issue.code}: ${issue.detail}`,
            tileIds: issue.nodeId ? [issue.nodeId] : undefined
        }));
        const routeTopologyIssues: BoardFairnessIssue[] = routeTopologyReport.issues.map((issue) => ({
            code: 'completion_route_missing',
            message: formatDungeonRunMapTopologyIssue(issue, routeTopologyReport),
            tileIds: issue.nodeId ? [issue.nodeId] : undefined
        }));
        result.failures.push({
            scenarioId: scenario.id,
            scenarioLabel: scenario.label,
            seed,
            floor,
            projection: 'next_floor',
            issueCodes: [
                nextIssue.code,
                ...nextReport.issues.map((candidate) => candidate.code),
                ...routeIssues.map((candidate) => candidate.code),
                ...routeTopologyIssues.map((candidate) => candidate.code)
            ],
            issueDetails: [
                formatIssueDetail(nextIssue),
                ...nextReport.issues.map(formatIssueDetail),
                ...routeIssues.map(formatIssueDetail),
                ...routeTopologyIssues.map(formatIssueDetail)
            ],
            issues: [nextIssue, ...nextReport.issues, ...routeIssues, ...routeTopologyIssues],
            boardSummary: boardSummary(next.board ?? solved.board ?? board)
        });
        return;
    }

    const issue: BoardFairnessIssue = {
        code: 'completion_route_missing',
        message:
            staleEnemyHazards.length > 0
                ? `Executable pair-exhaustion solver ended with ${staleEnemyHazards.length} stale enemy hazard overlay(s); expected all hazards defeated.`
                : `Executable pair-exhaustion solver stopped at ${trace.stopReason} after ${trace.turns} turn(s) with status=${solved.status}; expected levelComplete.`
    };
    const staleEnemyIssues: BoardFairnessIssue[] = staleEnemyHazards.map((hazard) => ({
        code: 'enemy_hazard_on_cleared_tile',
        message: `Enemy hazard "${hazard.id}" remains ${hazard.state} after playable clear.`,
        tileIds: [hazard.currentTileId, hazard.nextTileId]
    }));
    result.failures.push({
        scenarioId: scenario.id,
        scenarioLabel: scenario.label,
        seed,
        floor,
        projection: 'playable_clear',
        issueCodes: [
            issue.code,
            ...staleEnemyIssues.map((candidate) => candidate.code),
            ...report.issues.map((candidate) => candidate.code),
            ...topologyIssues.map((candidate) => candidate.code)
        ],
        issueDetails: [
            formatIssueDetail(issue),
            `solver_trace: reason=${trace.stopReason} turns=${trace.turns} lastPair=${trace.lastPairKey ?? 'none'} lastTiles=${trace.lastTileIds.join(',') || 'none'}`,
            ...staleEnemyIssues.map(formatIssueDetail),
            ...report.issues.map(formatIssueDetail),
            ...topologyIssues.map(formatIssueDetail)
        ],
        issues: [issue, ...staleEnemyIssues, ...report.issues, ...topologyIssues],
        boardSummary: boardSummary(solvedBoard)
    });
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

export interface ScheduledSoftlockFloorOptions {
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    activeMutators: MutatorId[];
    dungeonNodeKind: DungeonRunNodeKind | null;
}

export const scheduledSoftlockFloorTag = (floor: number): FloorTag =>
    floor === 7 || floor === 9 || floor === 12 ? 'boss' : floor === 10 ? 'breather' : 'normal';

export const scheduledSoftlockFloorArchetype = (floor: number): FloorArchetypeId | null =>
    floor === 4
        ? 'shadow_read'
        : floor === 7
          ? 'trap_hall'
          : floor === 9
            ? 'rush_recall'
            : floor === 10
              ? 'treasure_gallery'
              : null;

export const scheduledSoftlockFloorMutators = (floor: number): MutatorId[] =>
    floor === 7 ? ['glass_floor', 'sticky_fingers'] : floor === 9 ? ['short_memorize', 'wide_recall'] : [];

export const scheduledSoftlockFloorNodeKind = (floor: number): DungeonRunNodeKind | null =>
    floor === 3 ? 'shop' : floor === 5 ? 'elite' : floor === 7 ? 'trap' : floor === 9 || floor === 12 ? 'boss' : null;

export const getScheduledSoftlockFloorOptions = (floor: number): ScheduledSoftlockFloorOptions => ({
    floorTag: scheduledSoftlockFloorTag(floor),
    floorArchetypeId: scheduledSoftlockFloorArchetype(floor),
    activeMutators: scheduledSoftlockFloorMutators(floor),
    dungeonNodeKind: scheduledSoftlockFloorNodeKind(floor)
});

export const DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS: readonly SoftlockGeneratorScenario[] = [
    {
        id: 'endless_cycle',
        label: 'Endless cycle floors with authored pressure',
        seeds: [1, 42_001, 867_5309],
        floors: Array.from({ length: 12 }, (_, index) => index + 1),
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                ...getScheduledSoftlockFloorOptions(floor),
                cycleFloor: floor
            })
    },
    {
        id: 'route_pressure',
        label: 'Route-card pressure floors',
        seeds: [70_101, 70_202],
        floors: [2, 4, 6, 8],
        optionsForFloor: ({ seed, floor }) => {
            const routeType = ROUTE_TYPES[(seed + floor) % ROUTE_TYPES.length] ?? DEFAULT_ROUTE_TYPE;
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
    },
    {
        id: 'locked_exit_economy',
        label: 'Locked exit economy insurance',
        seeds: [130_011],
        floors: [6],
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                fixedTilesMode: 'exact',
                fixedTiles: [
                    { id: 'key-a', pairKey: 'key', symbol: 'K', label: 'Iron key', state: 'hidden', dungeonCardKind: 'key', dungeonKeyKind: 'iron' },
                    { id: 'key-b', pairKey: 'key', symbol: 'K', label: 'Iron key', state: 'hidden', dungeonCardKind: 'key', dungeonKeyKind: 'iron' },
                    { id: 'a1', pairKey: 'a', symbol: 'A', label: 'A', state: 'hidden' },
                    { id: 'a2', pairKey: 'a', symbol: 'A', label: 'A', state: 'hidden' },
                    {
                        id: 'exit',
                        pairKey: EXIT_PAIR_KEY,
                        symbol: 'E',
                        label: 'Iron exit',
                        state: 'hidden',
                        dungeonCardKind: 'exit',
                        dungeonExitLockKind: 'iron'
                    },
                    {
                        id: 'shop',
                        pairKey: '__shop__',
                        symbol: '$',
                        label: 'Shop',
                        state: 'hidden',
                        dungeonCardKind: 'shop',
                        dungeonCardEffectId: 'shop_vendor'
                    }
                ]
            })
    }
];

export const runSoftlockGeneratorContract = (
    scenarios: readonly SoftlockGeneratorScenario[] = DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS
): SoftlockGeneratorContractResult => {
    const result: SoftlockGeneratorContractResult = {
        checkedBoards: 0,
        checkedPlayableBoards: 0,
        checkedNextFloorTransitions: 0,
        checkedShopPlans: 0,
        failures: [],
        coverage: coverageTemplate()
    };

    for (const scenario of scenarios) {
        for (const seed of scenario.seeds) {
            for (const floor of scenario.floors) {
                const board = buildBoard(floor, scenario.optionsForFloor({ seed, floor }));
                recordInspection(result, scenario, seed, floor, 'generated', board);
                recordPlayableClearInspection(result, scenario, seed, floor, board);
                recordShopStockInspection(result, scenario, seed, floor, board);
                const finalPair = createFinalPairFairnessProjection(board);
                if (finalPair) {
                    recordInspection(result, scenario, seed, floor, 'final_pair', finalPair);
                }
                recordInspection(
                    result,
                    scenario,
                    seed,
                    floor,
                    'cleared_board',
                    createClearedBoardFairnessProjection(board)
                );
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
        `issues=${failure.issueDetails.length > 0 ? failure.issueDetails.join('; ') : failure.issueCodes.join(',') || 'completion_route_missing'}`
    ].join(' | ');
