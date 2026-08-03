/**
 * REF-098: Fast, deterministic endless schedule sampler (mutator / floor-tag counts).
 * Run: yarn sim:endless [--floors=10000] [--seed=42]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
    GAME_RULES_VERSION,
    type BoardState,
    type FindableKind
} from '../src/shared/contracts';
import { getFindableSpawnWeightRows } from '../src/shared/findables';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { buildBoard } from '../src/shared/board-generation';
import { getEffectivePrimaryExitLock, inspectBoardFairness } from '../src/shared/board-inspection';
import { activeEnemyHazardsForBoard } from '../src/shared/enemy-hazard-board-rules';
import { solveRunThroughGameplayCoreWithTrace } from '../src/shared/gameplay-core-playthrough-solver';
import { createGeneratedBoardSolverRun } from '../src/shared/softlock-generator-contract';
import { inspectDungeonBoardTopology, inspectDungeonRunMapTopology } from '../src/shared/dungeon-topology';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import {
    countTraitComboOpportunityPairs,
    getBoardTraitInteractionPreviewLines,
    hasTraitBoardPowerInteractionOpportunity,
    hasTraitRewardInteractionFloor,
    hasTraitSwapSetupOpportunity
} from '../src/shared/tile-trait-rules';
import { readFlooredNumericCliArg, readPositiveFlooredNumericCliArg } from './seed-sweep-options';

export interface EndlessSimulationCsvInput {
    floors: number;
    runSeed: number;
    rulesVersion?: number;
}

export interface EndlessSimulationCliOptions {
    floors: number;
    runSeed: number;
    summaryMode: boolean;
    checkMode: boolean;
    out?: string;
}

export interface EndlessSimulationHealthReport {
    ok: boolean;
    issues: string[];
    metrics: {
        deadTraitFloors: number;
        exitlessFloors: number;
        fairnessIssueCodes: string[];
        fairnessIssueFloors: number;
        fairnessIssueTypes: number;
        topologyIssueCodes: string[];
        topologyIssueFloors: number;
        topologyIssueTypes: number;
        exitLockTypes: number;
        findableTotal: number;
        lockedCacheRoomFloors: number;
        objectiveKinds: number;
        coreReplayCheckedFloors: number;
        playableCheckedFloors: number;
        playableFailureDetails: string[];
        playableIssueFloors: number;
        playableIssueReasons: string[];
        playableLockedExitFloors: number;
        rewardKinds: number;
        typedLockedCacheRoomFloors: number;
        traitBoardPowerInteractionFloorShare: number;
        traitMatchRouteFloorShare: number;
        routeKinds: number;
        traitFloorShare: number;
        traitInteractionLines: number;
        traitRewardFloorShare: number;
        traitSwapSetupFloorShare: number;
    };
}

type EndlessSimulationHealthMetrics = EndlessSimulationHealthReport['metrics'];

const emptyFindableKindCounts = (): Record<FindableKind, number> => ({
    shard_spark: 0,
    score_glint: 0,
    ward_spark: 0,
    scout_glint: 0
});

const shouldCheckPlayableBoard = (board: BoardState): boolean =>
    board.level <= 24 ||
    board.level % 25 === 0 ||
    board.floorTag === 'boss' ||
    getEffectivePrimaryExitLock({ board }).lockKind !== 'none';

const shouldVerifyPlayableReplay = (board: BoardState): boolean =>
    board.level <= 24 || board.level % 100 === 0 || board.floorTag === 'boss';

export const countUndefeatedEnemyHazardsForPlayableGate = (board: BoardState | null | undefined): number =>
    board?.enemyHazards?.filter((hazard) => hazard.state !== 'defeated').length ?? 0;

export const buildEndlessSimulationCsv = ({
    floors,
    runSeed,
    rulesVersion = GAME_RULES_VERSION
}: EndlessSimulationCsvInput): string => {
    const safeFloors = Math.max(1, Math.floor(floors));
    const safeRunSeed = Math.floor(runSeed);
    const mutatorCounts: Record<string, number> = {};
    const floorTagCounts: Record<string, number> = {};
    const floorArchetypeCounts: Record<string, number> = {};
    const objectiveCounts: Record<string, number> = {};
    const bossCounts: Record<string, number> = {};
    const dungeonCardKindCounts: Record<string, number> = {};
    const dungeonExitLockCounts: Record<string, number> = {};
    const dungeonExitCounts: Record<string, number> = {};
    const fairnessIssueCounts: Record<string, number> = {};
    const topologyIssueCounts: Record<string, number> = {};
    const playableIssueCounts: Record<string, number> = {};
    const playableFailureDetails: string[] = [];
    let coreReplayCheckedFloors = 0;
    let playableCheckedFloors = 0;
    let playableLockedExitFloors = 0;
    let lockedCacheRoomFloors = 0;
    let typedLockedCacheRoomFloors = 0;
    const traitMetricCounts: Record<string, number> = {
        traitFloors: 0,
        traitInteractionLines: 0,
        traitMatchRouteFloors: 0,
        traitSwapSetupFloors: 0,
        traitRewardFloors: 0,
        traitBoardPowerInteractionFloors: 0,
        deadTraitFloors: 0
    };
    const findableKindCounts = emptyFindableKindCounts();

    for (let level = 1; level <= safeFloors; level++) {
        const { mutators, floorTag, floorArchetypeId, featuredObjectiveId, cycleFloor } = pickFloorScheduleEntry(
            safeRunSeed,
            rulesVersion,
            level,
            'endless'
        );
        floorTagCounts[floorTag] = (floorTagCounts[floorTag] ?? 0) + 1;
        floorArchetypeCounts[floorArchetypeId ?? 'none'] = (floorArchetypeCounts[floorArchetypeId ?? 'none'] ?? 0) + 1;
        for (const m of mutators) {
            mutatorCounts[m] = (mutatorCounts[m] ?? 0) + 1;
        }
        const board = buildBoard(level, {
            runSeed: safeRunSeed,
            runRulesVersion: rulesVersion,
            activeMutators: mutators,
            floorTag,
            floorArchetypeId,
            featuredObjectiveId,
            cycleFloor,
            gameMode: 'endless'
        });
        objectiveCounts[board.dungeonObjectiveId ?? 'none'] = (objectiveCounts[board.dungeonObjectiveId ?? 'none'] ?? 0) + 1;
        bossCounts[board.dungeonBossId ?? 'none'] = (bossCounts[board.dungeonBossId ?? 'none'] ?? 0) + 1;
        const exits = board.tiles.filter((tile) => tile.dungeonCardKind === 'exit');
        const lockedCacheRoom = board.tiles.find(
            (tile) => tile.dungeonCardKind === 'room' && tile.dungeonCardEffectId === 'room_locked_cache'
        );
        if (lockedCacheRoom) {
            lockedCacheRoomFloors += 1;
            if ((lockedCacheRoom.dungeonKeyKind ?? 'iron') !== 'iron') {
                typedLockedCacheRoomFloors += 1;
            }
        }
        dungeonExitCounts[String(exits.length)] = (dungeonExitCounts[String(exits.length)] ?? 0) + 1;
        for (const exit of exits) {
            const lockKey = exit.dungeonExitLockKind ?? 'none';
            dungeonExitLockCounts[lockKey] = (dungeonExitLockCounts[lockKey] ?? 0) + 1;
        }
        const fairnessIssueCodes = new Set(inspectBoardFairness(board).issues.map((issue) => issue.code));
        if (fairnessIssueCodes.size > 0) {
            fairnessIssueCounts.floorWithIssue = (fairnessIssueCounts.floorWithIssue ?? 0) + 1;
            for (const code of fairnessIssueCodes) {
                fairnessIssueCounts[code] = (fairnessIssueCounts[code] ?? 0) + 1;
            }
        }
        const topologyIssueCodes = new Set(inspectDungeonBoardTopology(board).issues.map((issue) => issue.code));
        if (topologyIssueCodes.size > 0) {
            topologyIssueCounts.floorWithIssue = (topologyIssueCounts.floorWithIssue ?? 0) + 1;
            for (const code of topologyIssueCodes) {
                topologyIssueCounts[code] = (topologyIssueCounts[code] ?? 0) + 1;
            }
        }
        const effectiveExitLock = getEffectivePrimaryExitLock({ board });
        if (shouldCheckPlayableBoard(board)) {
            playableCheckedFloors += 1;
            if (effectiveExitLock.lockKind !== 'none') {
                playableLockedExitFloors += 1;
            }
            const trace = solveRunThroughGameplayCoreWithTrace(
                createGeneratedBoardSolverRun(board, safeRunSeed, rulesVersion),
                160,
                shouldVerifyPlayableReplay(board)
            );
            coreReplayCheckedFloors += trace.replayVerified ? 1 : 0;
            const activeStaleHazards =
                trace.run.status === 'levelComplete' ? activeEnemyHazardsForBoard(trace.run.board).length : 0;
            const undefeatedStaleHazards =
                trace.run.status === 'levelComplete'
                    ? countUndefeatedEnemyHazardsForPlayableGate(trace.run.board)
                    : 0;
            const solvedBoardTopologyIssues =
                trace.run.status === 'levelComplete'
                    ? inspectDungeonBoardTopology(trace.run.board ?? board, {
                          dungeonKeys: trace.run.dungeonKeys,
                          dungeonMasterKeys: trace.run.dungeonMasterKeys
                      }).issues
                    : [];
            const nextFloorRouteTopologyIssues =
                trace.run.status === 'levelComplete' && activeStaleHazards === 0 && undefeatedStaleHazards === 0
                    ? inspectDungeonRunMapTopology(advanceToNextLevel(trace.run).dungeonRun).issues
                    : [];
            const coreSolverIssues = [
                ...(trace.replayVerified && !trace.replayDeterministic ? ['command_replay_diverged'] : []),
                ...trace.rejectedCommandIds.map((commandId) => `rejected:${commandId}`),
                ...trace.invariantViolations
            ];
            if (
                trace.run.status !== 'levelComplete' ||
                coreSolverIssues.length > 0 ||
                activeStaleHazards > 0 ||
                undefeatedStaleHazards > 0 ||
                solvedBoardTopologyIssues.length > 0 ||
                nextFloorRouteTopologyIssues.length > 0
            ) {
                const reason =
                    coreSolverIssues.length > 0
                        ? 'core_solver_invariant'
                        : solvedBoardTopologyIssues.length > 0
                        ? 'solved_board_topology'
                        : nextFloorRouteTopologyIssues.length > 0
                        ? 'next_floor_route_topology'
                        : activeStaleHazards > 0 || undefeatedStaleHazards > 0
                          ? 'stale_enemy_hazard'
                          : trace.stopReason;
                playableIssueCounts.floorWithIssue = (playableIssueCounts.floorWithIssue ?? 0) + 1;
                playableIssueCounts[reason] = (playableIssueCounts[reason] ?? 0) + 1;
                playableFailureDetails.push(
                    [
                        `floor=${level}`,
                        `reason=${reason}`,
                        `status=${trace.run.status}`,
                        `turns=${trace.turns}`,
                        `lastPair=${trace.lastPairKey ?? 'none'}`,
                        `lastTiles=${trace.lastTileIds.join('+') || 'none'}`,
                        `activeStaleHazards=${activeStaleHazards}`,
                        `undefeatedStaleHazards=${undefeatedStaleHazards}`,
                        `solvedTopologyIssues=${solvedBoardTopologyIssues.map((issue) => issue.code).join('+') || 'none'}`,
                        `routeTopologyIssues=${nextFloorRouteTopologyIssues.map((issue) => issue.code).join('+') || 'none'}`,
                        `coreSolverIssues=${coreSolverIssues.join('+') || 'none'}`,
                        `archetype=${floorArchetypeId ?? 'none'}`,
                        `objective=${board.dungeonObjectiveId ?? 'none'}`
                    ].join('|')
                );
            }
        }
        const seenFindablePairs = new Set<string>();
        const seenDungeonPairs = new Set<string>();
        const traitPairKeys = new Set<string>();
        for (const tile of board.tiles) {
            if (tile.tileTraitKind) {
                traitPairKeys.add(tile.pairKey);
            }
            if (tile.findableKind && !seenFindablePairs.has(tile.pairKey)) {
                seenFindablePairs.add(tile.pairKey);
                findableKindCounts[tile.findableKind] += 1;
            }
            if (!tile.dungeonCardKind || seenDungeonPairs.has(tile.pairKey)) {
                continue;
            }
            seenDungeonPairs.add(tile.pairKey);
            dungeonCardKindCounts[tile.dungeonCardKind] = (dungeonCardKindCounts[tile.dungeonCardKind] ?? 0) + 1;
        }
        const traitInteractionLines = getBoardTraitInteractionPreviewLines(board).length;
        const traitComboOpportunityPairs = countTraitComboOpportunityPairs(board);
        const hasSwapSetup = hasTraitSwapSetupOpportunity(board);
        if (traitPairKeys.size > 0) {
            traitMetricCounts.traitFloors += 1;
            traitMetricCounts.traitInteractionLines += traitInteractionLines;
            traitMetricCounts.traitMatchRouteFloors += traitComboOpportunityPairs > 0 ? 1 : 0;
            traitMetricCounts.traitSwapSetupFloors += hasSwapSetup ? 1 : 0;
            traitMetricCounts.traitRewardFloors += hasTraitRewardInteractionFloor(board) ? 1 : 0;
            traitMetricCounts.traitBoardPowerInteractionFloors += hasTraitBoardPowerInteractionOpportunity(board, hasSwapSetup)
                ? 1
                : 0;
            if (traitInteractionLines === 0) {
                traitMetricCounts.deadTraitFloors += 1;
            }
        }
    }

    const lines = [
        'kind,key,count',
        ...Object.entries(floorTagCounts).map(([k, v]) => `floorTag,${k},${v}`),
        ...Object.entries(floorArchetypeCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `floorArchetype,${k},${v}`),
        ...Object.entries(mutatorCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `mutator,${k},${v}`),
        ...Object.entries(findableKindCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `findableKind,${k},${v}`),
        ...Object.entries(traitMetricCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `traitMetric,${k},${v}`),
        ...getFindableSpawnWeightRows()
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((row) => `findableTargetWeight,${row.id},${row.weight}`),
        ...Object.entries(objectiveCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `dungeonObjective,${k},${v}`),
        ...Object.entries(bossCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `dungeonBoss,${k},${v}`),
        ...Object.entries(dungeonCardKindCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `dungeonCardKind,${k},${v}`),
        ...Object.entries(dungeonExitCounts)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([k, v]) => `dungeonExitCount,${k},${v}`),
        ...Object.entries(dungeonExitLockCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `dungeonExitLock,${k},${v}`),
        ...Object.entries(fairnessIssueCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `fairnessIssue,${k},${v}`),
        ...Object.entries(topologyIssueCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `topologyIssue,${k},${v}`),
        `playableMetric,checkedFloors,${playableCheckedFloors}`,
        `playableMetric,replayCheckedFloors,${coreReplayCheckedFloors}`,
        `playableMetric,lockedExitFloors,${playableLockedExitFloors}`,
        `dungeonMetric,lockedCacheRoomFloors,${lockedCacheRoomFloors}`,
        `dungeonMetric,typedLockedCacheRoomFloors,${typedLockedCacheRoomFloors}`,
        ...Object.entries(playableIssueCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `playableIssue,${k},${v}`),
        ...playableFailureDetails
            .sort((a, b) => a.localeCompare(b))
            .map((detail) => `playableFailure,${detail},1`)
    ];

    return lines.join('\n') + '\n';
};

const parseCsvCounts = (csv: string): Record<string, Record<string, number>> => {
    const counts: Record<string, Record<string, number>> = {};
    for (const line of csv.trim().split('\n').slice(1)) {
        const [kind, key, count] = line.split(',');
        counts[kind] ??= {};
        counts[kind][key] = Number(count);
    }
    return counts;
};

const sumCounts = (counts: Record<string, number> | undefined): number =>
    Object.values(counts ?? {}).reduce((sum, value) => sum + value, 0);

const readEndlessSimulationMetrics = (input: EndlessSimulationCsvInput): EndlessSimulationHealthMetrics => {
    const csv = buildEndlessSimulationCsv(input);
    const counts = parseCsvCounts(csv);
    const floors = Math.max(1, Math.floor(input.floors));
    const routeKinds = Object.keys(counts.floorArchetype ?? {}).filter((key) => key !== 'none').length;
    const objectiveKinds = Object.keys(counts.dungeonObjective ?? {}).filter((key) => key !== 'none').length;
    const exitLockTypes = Object.keys(counts.dungeonExitLock ?? {}).filter((key) => key !== 'none').length;
    const fairnessIssueCodes = Object.keys(counts.fairnessIssue ?? {})
        .filter((key) => key !== 'floorWithIssue')
        .sort((a, b) => a.localeCompare(b));
    const fairnessIssueTypes = fairnessIssueCodes.length;
    const topologyIssueCodes = Object.keys(counts.topologyIssue ?? {})
        .filter((key) => key !== 'floorWithIssue')
        .sort((a, b) => a.localeCompare(b));
    const topologyIssueTypes = topologyIssueCodes.length;
    const findableTotal = sumCounts(counts.findableKind);
    const playableIssueReasons = Object.keys(counts.playableIssue ?? {})
        .filter((key) => key !== 'floorWithIssue')
        .sort((a, b) => a.localeCompare(b));
    const playableFailureDetails = Object.keys(counts.playableFailure ?? {}).sort((a, b) => a.localeCompare(b));
    const rewardKinds = Object.keys(counts.findableKind ?? {}).filter((key) => (counts.findableKind?.[key] ?? 0) > 0).length;
    const traitFloors = counts.traitMetric?.traitFloors ?? 0;
    const deadTraitFloors = counts.traitMetric?.deadTraitFloors ?? 0;
    const traitInteractionLines = counts.traitMetric?.traitInteractionLines ?? 0;
    const traitDenominator = Math.max(1, traitFloors);
    return {
        deadTraitFloors,
        exitlessFloors: counts.dungeonExitCount?.['0'] ?? 0,
        fairnessIssueCodes,
        fairnessIssueFloors: counts.fairnessIssue?.floorWithIssue ?? 0,
        fairnessIssueTypes,
        topologyIssueCodes,
        topologyIssueFloors: counts.topologyIssue?.floorWithIssue ?? 0,
        topologyIssueTypes,
        exitLockTypes,
        findableTotal,
        lockedCacheRoomFloors: counts.dungeonMetric?.lockedCacheRoomFloors ?? 0,
        objectiveKinds,
        coreReplayCheckedFloors: counts.playableMetric?.replayCheckedFloors ?? 0,
        playableCheckedFloors: counts.playableMetric?.checkedFloors ?? 0,
        playableFailureDetails,
        playableIssueFloors: counts.playableIssue?.floorWithIssue ?? 0,
        playableIssueReasons,
        playableLockedExitFloors: counts.playableMetric?.lockedExitFloors ?? 0,
        rewardKinds,
        typedLockedCacheRoomFloors: counts.dungeonMetric?.typedLockedCacheRoomFloors ?? 0,
        traitBoardPowerInteractionFloorShare:
            (counts.traitMetric?.traitBoardPowerInteractionFloors ?? 0) / traitDenominator,
        traitMatchRouteFloorShare: (counts.traitMetric?.traitMatchRouteFloors ?? 0) / traitDenominator,
        routeKinds,
        traitFloorShare: traitFloors / floors,
        traitInteractionLines,
        traitRewardFloorShare: (counts.traitMetric?.traitRewardFloors ?? 0) / traitDenominator,
        traitSwapSetupFloorShare: (counts.traitMetric?.traitSwapSetupFloors ?? 0) / traitDenominator
    };
};

export const evaluateEndlessSimulationHealth = (
    metrics: EndlessSimulationHealthMetrics,
    floors: number,
    expectedRewardKinds = getFindableSpawnWeightRows().length
): EndlessSimulationHealthReport => {
    const safeFloors = Math.max(1, Math.floor(floors));
    const issues = [
        metrics.routeKinds < 8 ? `Expected at least 8 floor archetypes, saw ${metrics.routeKinds}.` : null,
        metrics.objectiveKinds < 4 ? `Expected at least 4 dungeon objectives, saw ${metrics.objectiveKinds}.` : null,
        metrics.exitLockTypes < 2 ? `Expected at least 2 nontrivial exit lock types, saw ${metrics.exitLockTypes}.` : null,
        metrics.exitlessFloors > 0 ? `Expected every sampled floor to have an exit, saw ${metrics.exitlessFloors} exitless floors.` : null,
        metrics.fairnessIssueFloors > 0 || metrics.fairnessIssueTypes > 0
            ? `Expected generated boards to pass fairness inspection, saw ${metrics.fairnessIssueFloors} floor(s) with ${metrics.fairnessIssueTypes} issue type(s): ${metrics.fairnessIssueCodes.join(', ') || 'unknown'}.`
            : null,
        metrics.topologyIssueFloors > 0 || metrics.topologyIssueTypes > 0
            ? `Expected generated boards to pass topology inspection, saw ${metrics.topologyIssueFloors} floor(s) with ${metrics.topologyIssueTypes} issue type(s): ${metrics.topologyIssueCodes.join(', ') || 'unknown'}.`
            : null,
        metrics.playableCheckedFloors <= 0
            ? 'Expected executable playable solver sampling to inspect at least one floor.'
            : null,
        metrics.coreReplayCheckedFloors < Math.min(safeFloors, 24)
            ? `Expected command replay verification on the first ${Math.min(safeFloors, 24)} sampled floor(s), saw ${metrics.coreReplayCheckedFloors}.`
            : null,
        metrics.playableIssueFloors > 0
            ? `Expected playable solver sample to clear every checked floor, saw ${metrics.playableIssueFloors} issue floor(s): ${metrics.playableIssueReasons.join(', ') || 'unknown'}. Details: ${metrics.playableFailureDetails.slice(0, 5).join('; ') || 'none'}.`
            : null,
        safeFloors >= 20 && metrics.playableLockedExitFloors <= 0
            ? 'Expected executable playable solver sampling to include at least one live locked-exit floor.'
            : null,
        metrics.rewardKinds < expectedRewardKinds
            ? `Expected all ${expectedRewardKinds} findable reward kinds, saw ${metrics.rewardKinds}.`
            : null,
        metrics.findableTotal < Math.floor(safeFloors * 0.5)
            ? `Expected at least one findable reward per two floors, saw ${metrics.findableTotal} across ${safeFloors} floors.`
            : null,
        metrics.traitFloorShare < 0.8
            ? `Expected trait floors on at least 80.0% of floors, saw ${(metrics.traitFloorShare * 100).toFixed(1)}%.`
            : null,
        metrics.traitMatchRouteFloorShare < 0.95
            ? `Expected match-triggerable trait routes on at least 95.0% of trait floors, saw ${(metrics.traitMatchRouteFloorShare * 100).toFixed(1)}%.`
            : null,
        metrics.traitRewardFloorShare < 0.8
            ? `Expected reward-producing trait interactions on at least 80.0% of trait floors, saw ${(metrics.traitRewardFloorShare * 100).toFixed(1)}%.`
            : null,
        metrics.traitBoardPowerInteractionFloorShare < 0.7
            ? `Expected board-power trait interactions on at least 70.0% of trait floors, saw ${(metrics.traitBoardPowerInteractionFloorShare * 100).toFixed(1)}%.`
            : null,
        metrics.traitSwapSetupFloorShare < 0.1
            ? `Expected one-swap trait setup opportunities on at least 10.0% of trait floors, saw ${(metrics.traitSwapSetupFloorShare * 100).toFixed(1)}%.`
            : null,
        metrics.deadTraitFloors > 0 ? `Expected 0 dead trait floors, saw ${metrics.deadTraitFloors}.` : null,
        metrics.traitInteractionLines < safeFloors
            ? `Expected at least ${safeFloors} trait interaction preview lines, saw ${metrics.traitInteractionLines}.`
            : null
    ].filter((issue): issue is string => issue != null);

    return { ok: issues.length === 0, issues, metrics };
};

export const analyzeEndlessSimulationHealth = (input: EndlessSimulationCsvInput): EndlessSimulationHealthReport => {
    const metrics = readEndlessSimulationMetrics(input);
    const floors = Math.max(1, Math.floor(input.floors));
    return evaluateEndlessSimulationHealth(metrics, floors);
};

const formatEndlessSimulationSummary = (
    input: EndlessSimulationCsvInput,
    metrics: EndlessSimulationHealthMetrics
): string => {
    const floors = Math.max(1, Math.floor(input.floors));
    const pct = (value: number) => `${((value / floors) * 100).toFixed(1)}%`;

    return [
        '# Endless Simulation Gate Summary',
        '',
        `- Floors sampled: ${floors}`,
        `- Seed: ${Math.floor(input.runSeed)}`,
        `- Rules version: ${input.rulesVersion ?? GAME_RULES_VERSION}`,
        `- Route gates: ${metrics.routeKinds} floor archetypes, ${metrics.objectiveKinds} objectives, ${metrics.exitLockTypes} exit lock types, ${metrics.exitlessFloors} exitless floors.`,
        `- Fairness gates: ${metrics.fairnessIssueFloors} issue floors across ${metrics.fairnessIssueTypes} issue types (${metrics.fairnessIssueCodes.join(', ') || 'none'}).`,
        `- Topology gates: ${metrics.topologyIssueFloors} issue floors across ${metrics.topologyIssueTypes} issue types (${metrics.topologyIssueCodes.join(', ') || 'none'}).`,
        `- Playable gates: ${metrics.playableCheckedFloors} sampled floors, ${metrics.coreReplayCheckedFloors} replay-verified floors, ${metrics.playableLockedExitFloors} locked-exit floors, ${metrics.playableIssueFloors} issue floors (${metrics.playableIssueReasons.join(', ') || 'none'}).`,
        `- Dungeon room gates: ${metrics.lockedCacheRoomFloors} locked cache room floors, ${metrics.typedLockedCacheRoomFloors} typed locked cache room floors.`,
        `- Reward gates: ${metrics.findableTotal} findable rewards across ${metrics.rewardKinds} active reward kinds.`,
        `- Trait gates: ${Math.round(metrics.traitFloorShare * floors)} trait floors (${pct(metrics.traitFloorShare * floors)}), ${metrics.traitInteractionLines} interaction lines, ${metrics.deadTraitFloors} dead trait floors.`,
        `- Trait mechanic gates: ${(metrics.traitMatchRouteFloorShare * 100).toFixed(1)}% match-route floors, ${(metrics.traitRewardFloorShare * 100).toFixed(1)}% reward floors, ${(metrics.traitBoardPowerInteractionFloorShare * 100).toFixed(1)}% board-power floors, ${(metrics.traitSwapSetupFloorShare * 100).toFixed(1)}% one-swap setup floors.`,
        ''
    ].join('\n');
};

export const buildEndlessSimulationSummary = (input: EndlessSimulationCsvInput): string =>
    formatEndlessSimulationSummary(input, readEndlessSimulationMetrics(input));

export const parseEndlessSimulationCliOptions = (argv: readonly string[]): EndlessSimulationCliOptions => {
    const outPrefix = '--out=';
    const out = argv.find((arg) => arg.startsWith(outPrefix))?.slice(outPrefix.length);

    return {
        floors: Math.max(1, readFlooredNumericCliArg(argv, 'floors', 10_000)),
        runSeed: readPositiveFlooredNumericCliArg(argv, 'seed', 42_001),
        summaryMode: argv.includes('--summary'),
        checkMode: argv.includes('--check'),
        ...(out ? { out } : {})
    };
};

const runCli = (argv: readonly string[]): void => {
    const { floors, runSeed, summaryMode, checkMode, out } = parseEndlessSimulationCliOptions(argv);
    const input = { floors, runSeed };
    const health = checkMode ? analyzeEndlessSimulationHealth(input) : null;
    const output = health
        ? formatEndlessSimulationSummary(input, health.metrics)
        : summaryMode
          ? buildEndlessSimulationSummary(input)
          : buildEndlessSimulationCsv(input);
    process.stdout.write(output);
    if (health) {
        if (health.ok) {
            process.stdout.write('Endless simulation health check passed\n');
        } else {
            process.stderr.write(`Endless simulation health check failed:\n${health.issues.map((issue) => `- ${issue}`).join('\n')}\n`);
            process.exitCode = 1;
        }
    }

    if (out) {
        writeFileSync(out, output, 'utf8');
    }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    runCli(process.argv.slice(2));
}
