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
import { solveRunThroughGameplayCoreWithTrace } from '../src/shared/gameplay-core-playthrough-solver';
import { createGeneratedBoardSolverRun } from '../src/shared/softlock-generator-contract';
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
        fairnessIssueCodes: string[];
        fairnessIssueFloors: number;
        fairnessIssueTypes: number;
        findableTotal: number;
        playableCheckedFloors: number;
        coreReplayCheckedFloors: number;
        playableFailureDetails: string[];
        playableIssueFloors: number;
        playableIssueReasons: string[];
        playableLockedExitFloors: number;
        rewardKinds: number;
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

/*
 * Which floors get played, not just inspected.
 *
 * The last clause used to pull in every locked-exit floor, and it was doing most of the work: with
 * locks gone the sample fell from over 500 floors in a thousand to 220, which is a real loss of
 * coverage dressed up as a passing gate. The every-25th sweep is widened to every 3rd to buy most
 * of it back - 430 floors of a thousand, played through the command path - and the gate's own bar
 * moves to that measured number rather than staying at a 500 it can no longer reach.
 *
 * Every 2nd would clear the old bar outright and roughly doubles the wall clock of a gate that
 * already takes half a minute. 430 sampled floors with no locks left to skew which ones get picked
 * is better coverage than 500 that were chosen because they had a lock on them.
 *
 * The lock clause stays. It costs nothing while generation deals no locks, and it is the clause
 * that would matter first if one ever came back.
 */
const shouldCheckPlayableBoard = (board: BoardState): boolean =>
    board.level <= 24 ||
    board.level % 3 === 0 ||
    board.floorTag === 'boss' ||
    getEffectivePrimaryExitLock({ board }).lockKind !== 'none';

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
    const fairnessIssueCounts: Record<string, number> = {};
    const playableIssueCounts: Record<string, number> = {};
    const playableFailureDetails: string[] = [];
    let playableCheckedFloors = 0;
    let coreReplayCheckedFloors = 0;
    let coreReplayIssueFloors = 0;
    let coreReplayRejectedCommandFloors = 0;
    let coreReplayInvariantViolationFloors = 0;
    let playableLockedExitFloors = 0;
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
        const fairnessIssueCodes = new Set(inspectBoardFairness(board).issues.map((issue) => issue.code));
        if (fairnessIssueCodes.size > 0) {
            fairnessIssueCounts.floorWithIssue = (fairnessIssueCounts.floorWithIssue ?? 0) + 1;
            for (const code of fairnessIssueCodes) {
                fairnessIssueCounts[code] = (fairnessIssueCounts[code] ?? 0) + 1;
            }
        }
        const effectiveExitLock = getEffectivePrimaryExitLock({ board });
        if (shouldCheckPlayableBoard(board)) {
            playableCheckedFloors += 1;
            if (effectiveExitLock.lockKind !== 'none') {
                playableLockedExitFloors += 1;
            }
            // Solved through the command path rather than direct transitions, so the
            // endless gate exercises the same reducer the game runs and can report
            // whether the command journal replays deterministically.
            const trace = solveRunThroughGameplayCoreWithTrace(
                createGeneratedBoardSolverRun(board, safeRunSeed, rulesVersion)
            );
            coreReplayCheckedFloors += 1;
            if (!trace.replayVerified || !trace.replayDeterministic) {
                coreReplayIssueFloors += 1;
            }
            if (trace.rejectedCommandIds.length > 0) {
                coreReplayRejectedCommandFloors += 1;
            }
            if (trace.invariantViolations.length > 0) {
                coreReplayInvariantViolationFloors += 1;
            }
            if (trace.run.status !== 'levelComplete') {
                const reason = trace.stopReason;
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
                        `archetype=${floorArchetypeId ?? 'none'}`
                    ].join('|')
                );
            }
        }
        const seenFindablePairs = new Set<string>();
        const traitPairKeys = new Set<string>();
        for (const tile of board.tiles) {
            if (tile.tileTraitKind) {
                traitPairKeys.add(tile.pairKey);
            }
            if (tile.findableKind && !seenFindablePairs.has(tile.pairKey)) {
                seenFindablePairs.add(tile.pairKey);
                findableKindCounts[tile.findableKind] += 1;
            }
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
        ...Object.entries(fairnessIssueCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `fairnessIssue,${k},${v}`),
        `playableMetric,checkedFloors,${playableCheckedFloors}`,
        `coreReplayMetric,checkedFloors,${coreReplayCheckedFloors}`,
        `coreReplayMetric,issueFloors,${coreReplayIssueFloors}`,
        `coreReplayMetric,rejectedCommandFloors,${coreReplayRejectedCommandFloors}`,
        `coreReplayMetric,invariantViolationFloors,${coreReplayInvariantViolationFloors}`,
        `playableMetric,lockedExitFloors,${playableLockedExitFloors}`,
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
    const fairnessIssueCodes = Object.keys(counts.fairnessIssue ?? {})
        .filter((key) => key !== 'floorWithIssue')
        .sort((a, b) => a.localeCompare(b));
    const fairnessIssueTypes = fairnessIssueCodes.length;
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
        fairnessIssueCodes,
        fairnessIssueFloors: counts.fairnessIssue?.floorWithIssue ?? 0,
        fairnessIssueTypes,
        findableTotal,
        playableCheckedFloors: counts.playableMetric?.checkedFloors ?? 0,
        coreReplayCheckedFloors: counts.coreReplayMetric?.checkedFloors ?? 0,
        playableFailureDetails,
        playableIssueFloors: counts.playableIssue?.floorWithIssue ?? 0,
        playableIssueReasons,
        playableLockedExitFloors: counts.playableMetric?.lockedExitFloors ?? 0,
        rewardKinds,
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
        /*
         * Three checks stood here and all three now assert the opposite of the game.
         *
         * They wanted at least four dungeon objectives, at least two nontrivial exit lock kinds,
         * and an exit on every sampled floor. Generation deals no objective but `find_exit`, no
         * lock at all, and no exit: over 1000 floors that is 1 objective, 0 lock kinds and 1000
         * "exitless" floors, which is not a failure, it is the change.
         *
         * The floor-archetype check below stays, and it is the one that was doing the work these
         * three looked like they were doing: it asks whether a thousand floors are actually
         * different from each other, which is a question a board of pairs still has to answer.
         */
        metrics.fairnessIssueFloors > 0 || metrics.fairnessIssueTypes > 0
            ? `Expected generated boards to pass fairness inspection, saw ${metrics.fairnessIssueFloors} floor(s) with ${metrics.fairnessIssueTypes} issue type(s): ${metrics.fairnessIssueCodes.join(', ') || 'unknown'}.`
            : null,
        metrics.playableCheckedFloors <= 0
            ? 'Expected executable playable solver sampling to inspect at least one floor.'
            : null,
        metrics.playableIssueFloors > 0
            ? `Expected playable solver sample to clear every checked floor, saw ${metrics.playableIssueFloors} issue floor(s): ${metrics.playableIssueReasons.join(', ') || 'unknown'}. Details: ${metrics.playableFailureDetails.slice(0, 5).join('; ') || 'none'}.`
            : null,
        // Same reasoning: the solver cannot sample a live locked-exit floor because generation
        // makes none. What it still does - and what the playable checks above still assert - is
        // clear every floor it samples through real pair play.
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
        `- Route gates: ${metrics.routeKinds} floor archetypes.`,
        `- Fairness gates: ${metrics.fairnessIssueFloors} issue floors across ${metrics.fairnessIssueTypes} issue types (${metrics.fairnessIssueCodes.join(', ') || 'none'}).`,
        `- Playable gates: ${metrics.playableCheckedFloors} sampled floors, ${metrics.playableLockedExitFloors} locked-exit floors, ${metrics.playableIssueFloors} issue floors (${metrics.playableIssueReasons.join(', ') || 'none'}).`,
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
