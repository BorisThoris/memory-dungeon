import {
    GAME_RULES_VERSION,
    type BoardState,
    type FloorArchetypeId,
    type FloorTag,
    type MutatorId,
    type RunState,
    type Tile
} from './contracts';
import { isSingletonUtilityPairKey } from './tile-identity';
import { buildBoard, type BuildBoardOptions } from './board-build-rules';
import { countFindablePairs } from './board-generation';
import {
    inspectBoardFairness,
    inspectRunFairness,
    type BoardFairnessIssue
} from './board-inspection';
import { advanceToNextLevel } from './next-floor-transition-rules';
import {
    solveRunThroughGameplayCoreWithTrace,
    type GameplayCorePlaythroughSolverTrace
} from './gameplay-core-playthrough-solver';
import { createNewRun } from './run-creation-rules';
import { getBoardTraitInteractionPreviewLines } from './tile-trait-rules';

/*
 * Nine of these went with the dungeon layer: `locks`, `shops`, `keys`, `levers`, `exits`,
 * `hazards`, `enemies`, `bosses` and `topology`. They are removed rather than left reading zero,
 * because this list is the contract's own claim about what it covers - a key named here and stuck
 * at nought says the contract checks something it does not.
 */
export type SoftlockContractCoverageKey =
    | 'traits'
    | 'traitInteractions'
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
    projection: 'generated' | 'final_pair' | 'cleared_board' | 'playable_clear' | 'next_floor';
    issueCodes: string[];
    issueDetails: string[];
    issues: BoardFairnessIssue[];
    boardSummary: string;
}

export interface SoftlockGeneratorContractResult {
    checkedBoards: number;
    checkedPlayableBoards: number;
    checkedNextFloorTransitions: number;
    failures: SoftlockGeneratorFailure[];
    coverage: Record<SoftlockContractCoverageKey, number>;
}

const COVERAGE_KEYS: readonly SoftlockContractCoverageKey[] = [
    'traits',
    'traitInteractions',
    'finalPairStates'
];

const coverageTemplate = (): Record<SoftlockContractCoverageKey, number> =>
    Object.fromEntries(COVERAGE_KEYS.map((key) => [key, 0])) as Record<SoftlockContractCoverageKey, number>;

const boardSummary = (board: BoardState): string =>
    [
        `level=${board.level}`,
        `pairs=${board.pairCount}`,
        `floorTag=${board.floorTag ?? 'normal'}`,
        `archetype=${board.floorArchetypeId ?? 'none'}`
    ].join(' ');

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
    return {
        ...createNewRun(0, { runSeed: seed, runRulesVersionOverride: rulesVersion }),
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };
};

export const solveGeneratedBoardByExhaustingPairs = (board: BoardState, seed: number): RunState => {
    const run = createGeneratedBoardSolverRun(board, seed);
    return solveRunThroughGameplayCoreWithTrace(run).run;
};

const solveGeneratedBoardByExhaustingPairsWithTrace = (board: BoardState, seed: number): GameplayCorePlaythroughSolverTrace => {
    return solveRunThroughGameplayCoreWithTrace(createGeneratedBoardSolverRun(board, seed));
};

const pickFinalPairKey = (board: BoardState): string | null => realPairKeys(board)[0] ?? null;

export const createFinalPairFairnessProjection = (board: BoardState): BoardState | null => {
    const remainingPairKey = pickFinalPairKey(board);
    if (!remainingPairKey) {
        return null;
    }
    const tiles = board.tiles.map((tile) =>
        tile.pairKey === remainingPairKey || isSingletonUtilityPairKey(tile.pairKey)
            ? { ...tile, state: 'hidden' as const }
            : { ...tile, state: 'matched' as const }
    );
    return {
        ...board,
        tiles,
        flippedTileIds: [],
        matchedPairs: countMatchedPairs(tiles)
    };
};

export const createClearedBoardFairnessProjection = (board: BoardState): BoardState => {
    const tiles = board.tiles.map((tile) =>
        isSingletonUtilityPairKey(tile.pairKey) ? { ...tile } : { ...tile, state: 'matched' as const }
    );
    return {
        ...board,
        tiles,
        flippedTileIds: [],
        matchedPairs: countMatchedPairs(tiles)
    };
};

const addCoverage = (
    coverage: Record<SoftlockContractCoverageKey, number>,
    board: BoardState,
    projection: 'generated' | 'final_pair' | 'cleared_board'
): void => {
    if (board.tiles.some((tile) => tile.tileTraitKind != null)) coverage.traits += 1;
    if (getBoardTraitInteractionPreviewLines(board).length > 0) coverage.traitInteractions += 1;
    if (projection === 'final_pair' || projection === 'cleared_board') coverage.finalPairStates += 1;
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
    addCoverage(result.coverage, board, projection);
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
    const completionRouteIssues: BoardFairnessIssue[] = report.hasCompletionRoute
        ? []
        : [
              {
                  code: 'completion_route_missing',
                  message: 'Board has no structural completion route.'
              }
          ];
    const issues = [
        ...report.issues,
        ...completionRouteIssues,
        ...generatedTraitInteractionIssues
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
    const report = inspectBoardFairness(solvedBoard);
    const coreSolverIssues = [
        ...(!trace.replayVerified ? ['command_replay_not_verified'] : []),
        ...(trace.replayVerified && !trace.replayDeterministic ? ['command_replay_diverged'] : []),
        ...trace.rejectedCommandIds.map((commandId) => `rejected:${commandId}`),
        ...trace.invariantViolations
    ];
    if (solved.status === 'levelComplete' && coreSolverIssues.length === 0 && report.issues.length === 0) {
        result.checkedNextFloorTransitions += 1;
        const next = advanceToNextLevel(solved);
        const nextReport = inspectRunFairness(next);
        if (next.status === 'memorize' && next.board?.level === floor + 1 && nextReport.issues.length === 0) {
            return;
        }

        const nextIssue: BoardFairnessIssue = {
            code: 'completion_route_missing',
            message: `Next-floor transition ended with status=${next.status}, boardLevel=${next.board?.level ?? 'none'}; expected fair memorize run for level ${floor + 1}.`
        };
        result.failures.push({
            scenarioId: scenario.id,
            scenarioLabel: scenario.label,
            seed,
            floor,
            projection: 'next_floor',
            issueCodes: [nextIssue.code, ...nextReport.issues.map((candidate) => candidate.code)],
            issueDetails: [formatIssueDetail(nextIssue), ...nextReport.issues.map(formatIssueDetail)],
            issues: [nextIssue, ...nextReport.issues],
            boardSummary: boardSummary(next.board ?? solved.board ?? board)
        });
        return;
    }

    const issue: BoardFairnessIssue = {
        code: 'completion_route_missing',
        message:
            coreSolverIssues.length > 0
                ? `Typed gameplay-core solver reported ${coreSolverIssues.join(', ')}.`
                : `Executable pair-exhaustion solver stopped at ${trace.stopReason} after ${trace.turns} turn(s) with status=${solved.status}; expected levelComplete.`
    };
    result.failures.push({
        scenarioId: scenario.id,
        scenarioLabel: scenario.label,
        seed,
        floor,
        projection: 'playable_clear',
        issueCodes: [issue.code, ...report.issues.map((candidate) => candidate.code)],
        issueDetails: [
            formatIssueDetail(issue),
            `solver_trace: reason=${trace.stopReason} turns=${trace.turns} lastPair=${trace.lastPairKey ?? 'none'} lastTiles=${trace.lastTileIds.join(',') || 'none'} replayVerified=${trace.replayVerified} replayDeterministic=${trace.replayDeterministic} rejected=${trace.rejectedCommandIds.join(',') || 'none'} invariants=${trace.invariantViolations.join(',') || 'none'}`,
            ...report.issues.map(formatIssueDetail)
        ],
        issues: [issue, ...report.issues],
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
    floor === 7 ? ['sticky_fingers'] : floor === 9 ? ['short_memorize', 'wide_recall'] : [];

export const getScheduledSoftlockFloorOptions = (floor: number): ScheduledSoftlockFloorOptions => ({
    floorTag: scheduledSoftlockFloorTag(floor),
    floorArchetypeId: scheduledSoftlockFloorArchetype(floor),
    activeMutators: scheduledSoftlockFloorMutators(floor)
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
        id: 'boss_pressure',
        label: 'Boss identity pressure floors',
        seeds: [90_001, 90_002, 90_003],
        floors: [7, 9, 12],
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                floorTag: 'boss',
                floorArchetypeId: floor === 9 ? 'rush_recall' : null,
                activeMutators: floor === 9 ? ['short_memorize', 'wide_recall'] : []
            })
    },
    {
        id: 'trait_pressure',
        label: 'Trait and utility overlap floors',
        seeds: [120_011, 120_022],
        floors: [3, 5, 7, 9, 11],
        optionsForFloor: ({ seed, floor }) =>
            scenarioOptions(seed, floor, {
                floorTag: floor === 7 ? 'boss' : 'normal',
                floorArchetypeId: floor === 7 ? 'trap_hall' : floor === 9 ? 'spotlight_hunt' : 'shadow_read',
                activeMutators: ['shifting_spotlight']
            })
    },
    /*
     * `locked_exit_economy` stood here: a hand-built floor with an iron key pair, an iron-locked
     * exit and a shop, insuring the one economy that could strand a player - a lock whose key the
     * floor never deals. It is removed because generation no longer deals a lock, a key or an exit,
     * so the scenario was insuring a rule against a board no player can be given.
     *
     * The insurance it provided has not gone anywhere; it has moved down a level. What actually
     * strands a player now is a floor with a pair on it that cannot be flipped, and the scenarios
     * above catch that through the same pair-exhaustion solver, on boards generation really makes.
     */
];

export const runSoftlockGeneratorContract = (
    scenarios: readonly SoftlockGeneratorScenario[] = DEFAULT_SOFTLOCK_GENERATOR_SCENARIOS
): SoftlockGeneratorContractResult => {
    const result: SoftlockGeneratorContractResult = {
        checkedBoards: 0,
        checkedPlayableBoards: 0,
        checkedNextFloorTransitions: 0,
        failures: [],
        coverage: coverageTemplate()
    };

    for (const scenario of scenarios) {
        for (const seed of scenario.seeds) {
            for (const floor of scenario.floors) {
                const board = buildBoard(floor, scenario.optionsForFloor({ seed, floor }));
                recordInspection(result, scenario, seed, floor, 'generated', board);
                recordPlayableClearInspection(result, scenario, seed, floor, board);
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
