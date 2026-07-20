import { fileURLToPath } from 'node:url';

import { buildBoard } from '../src/shared/board-generation';
import { GAME_RULES_VERSION, type DungeonRunNode, type RouteNodeType } from '../src/shared/contracts';
import {
    formatDungeonBoardTopologyIssue,
    formatDungeonRunMapTopologyIssue,
    inspectDungeonBoardTopology,
    inspectDungeonRunMapTopology
} from '../src/shared/dungeon-topology';
import { getFloorArchetypeProgressionReport, pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import {
    createDungeonRunMapState,
    enterSelectedDungeonNode,
    generateRunMapChoices,
    revealDungeonChoices,
    selectDungeonNode
} from '../src/shared/run-map';
import { readFlooredNumericCliArg, resolveSeedSweep } from './seed-sweep-options';

const REQUIRED_ROUTE_NODE_KINDS = ['boss', 'combat', 'elite', 'event', 'rest', 'shop', 'trap', 'treasure'] as const;

const boolArg = (argv: readonly string[], name: string): boolean => argv.includes(`--${name}`);

export interface DungeonTopologyAuditFailure {
    seed: number;
    floor: number;
    scope: 'board' | 'route' | 'selected_branch' | 'entered_branch' | 'target_board';
    targetId?: string;
    issueCodes: string[];
    issues: string[];
}

export interface DungeonTopologyAuditSeedSummary {
    seed: number;
    boardsPassed: number;
    routesPassed: number;
    floors: number;
}

export interface DungeonTopologyAuditContextCounts {
    floorArchetypes: Record<string, number>;
    featuredObjectives: Record<string, number>;
    floorTags: Record<string, number>;
    mutators: Record<string, number>;
    routeNodeKinds: Record<string, number>;
}

export interface DungeonTopologyAuditResult {
    floors: number;
    rulesVersion: number;
    seeds: number[];
    checkedBoards: number;
    checkedRoutes: number;
    checkedRouteBranches: number;
    checkedRouteTargetBoards: number;
    issueBoards: number;
    issueRoutes: number;
    issueRouteBranches: number;
    issueRouteTargetBoards: number;
    issueCounts: Record<string, number>;
    coverageCounts: DungeonTopologyAuditContextCounts;
    issueContextCounts: DungeonTopologyAuditContextCounts;
    coverageGaps: string[];
    seedSummaries: DungeonTopologyAuditSeedSummary[];
    failures: DungeonTopologyAuditFailure[];
}

export interface DungeonTopologyAuditOptions {
    floors: number;
    rulesVersion: number;
    seeds: readonly number[];
    requireFullScheduleCoverage: boolean;
}

export const parseDungeonTopologyAuditOptions = (argv: readonly string[]): DungeonTopologyAuditOptions => {
    return {
        floors: Math.max(1, readFlooredNumericCliArg(argv, 'floors', 1000)),
        rulesVersion: Math.max(1, readFlooredNumericCliArg(argv, 'rulesVersion', GAME_RULES_VERSION)),
        requireFullScheduleCoverage: boolArg(argv, 'requireFullScheduleCoverage'),
        seeds: resolveSeedSweep(argv, [42_001, 42_002, 77_707, 130_011, 420_113, 880_037])
    };
};

export const analyzeDungeonTopologyAudit = ({
    floors,
    rulesVersion,
    seeds,
    requireFullScheduleCoverage
}: DungeonTopologyAuditOptions): DungeonTopologyAuditResult => {
    const result: DungeonTopologyAuditResult = {
        floors,
        rulesVersion,
        seeds: [...seeds],
        checkedBoards: 0,
        checkedRoutes: 0,
        checkedRouteBranches: 0,
        checkedRouteTargetBoards: 0,
        issueBoards: 0,
        issueRoutes: 0,
        issueRouteBranches: 0,
        issueRouteTargetBoards: 0,
        issueCounts: {},
        coverageCounts: {
            floorArchetypes: {},
            featuredObjectives: {},
            floorTags: {},
            mutators: {},
            routeNodeKinds: {}
        },
        issueContextCounts: {
            floorArchetypes: {},
            featuredObjectives: {},
            floorTags: {},
            mutators: {},
            routeNodeKinds: {}
        },
        coverageGaps: [],
        seedSummaries: [],
        failures: []
    };

    const increment = (counts: Record<string, number>, key: string | null | undefined): void => {
        counts[key ?? 'none'] = (counts[key ?? 'none'] ?? 0) + 1;
    };

    const recordContext = (
        counts: DungeonTopologyAuditContextCounts,
        schedule: ReturnType<typeof pickFloorScheduleEntry>,
        routeNode?: Pick<DungeonRunNode, 'kind'> | null
    ): void => {
        increment(counts.floorArchetypes, schedule.floorArchetypeId);
        increment(counts.featuredObjectives, schedule.featuredObjectiveId);
        increment(counts.floorTags, schedule.floorTag);
        if (routeNode) {
            increment(counts.routeNodeKinds, routeNode.kind);
        }
        if (schedule.mutators.length === 0) {
            increment(counts.mutators, 'none');
            return;
        }
        for (const mutator of schedule.mutators) {
            increment(counts.mutators, mutator);
        }
    };

    const buildRouteTargetBoard = (
        seed: number,
        rulesVersion: number,
        currentFloor: number,
        target: DungeonRunNode
    ): ReturnType<typeof buildBoard> => {
        const targetSchedule = pickFloorScheduleEntry(seed, rulesVersion, target.floor, 'endless');
        return buildBoard(target.floor, {
            runSeed: seed,
            runRulesVersion: rulesVersion,
            activeMutators: targetSchedule.mutators,
            cycleFloor: targetSchedule.cycleFloor,
            featuredObjectiveId: targetSchedule.featuredObjectiveId,
            floorArchetypeId: targetSchedule.floorArchetypeId,
            floorTag: targetSchedule.floorTag,
            dungeonNodeKind: target.kind,
            routeCardPlan: {
                choiceId: target.choiceId ?? target.id,
                routeType: (target.routeApproachType ?? target.routeType) as RouteNodeType,
                sourceLevel: currentFloor,
                targetLevel: target.floor
            },
            gameMode: 'endless'
        });
    };

    const recordIssueCodes = (codes: readonly string[]): void => {
        for (const code of codes) {
            result.issueCounts[code] = (result.issueCounts[code] ?? 0) + 1;
        }
    };

    for (const seed of seeds) {
        let seedIssueBoards = 0;
        let seedIssueRoutes = 0;
        let routeState = createDungeonRunMapState(seed, rulesVersion, 1);
        for (let floor = 1; floor <= floors; floor += 1) {
            const schedule = pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless');
            recordContext(result.coverageCounts, schedule);
            const board = buildBoard(floor, {
                runSeed: seed,
                runRulesVersion: rulesVersion,
                activeMutators: schedule.mutators,
                cycleFloor: schedule.cycleFloor,
                featuredObjectiveId: schedule.featuredObjectiveId,
                floorArchetypeId: schedule.floorArchetypeId,
                floorTag: schedule.floorTag,
                gameMode: 'endless'
            });
            const report = inspectDungeonBoardTopology(board);
            result.checkedBoards += 1;
            if (report.issues.length > 0) {
                const issueCodes = report.issues.map((issue) => issue.code);
                recordIssueCodes(issueCodes);
                recordContext(result.issueContextCounts, schedule);
                result.issueBoards += 1;
                seedIssueBoards += 1;
                result.failures.push({
                    seed,
                    floor,
                    scope: 'board',
                    issueCodes,
                    issues: report.issues.map((issue) => formatDungeonBoardTopologyIssue(issue, report))
                });
            }

            const choices = generateRunMapChoices({ runSeed: seed, rulesVersion, currentFloor: floor });
            const revealed = revealDungeonChoices(routeState, floor, choices);
            const routeReport = inspectDungeonRunMapTopology(revealed);
            result.checkedRoutes += 1;
            if (routeReport.issues.length > 0) {
                const issueCodes = routeReport.issues.map((issue) => issue.code);
                recordIssueCodes(issueCodes);
                recordContext(result.issueContextCounts, schedule);
                result.issueRoutes += 1;
                seedIssueRoutes += 1;
                result.failures.push({
                    seed,
                    floor,
                    scope: 'route',
                    issueCodes,
                    issues: routeReport.issues.map((issue) => formatDungeonRunMapTopologyIssue(issue, routeReport))
                });
                routeState = revealed;
                continue;
            }

            for (const targetId of routeReport.legalTargetIds) {
                const targetNode = revealed.nodes.find((node) => node.id === targetId);
                if (targetNode) {
                    const targetSchedule = pickFloorScheduleEntry(seed, rulesVersion, targetNode.floor, 'endless');
                    recordContext(result.coverageCounts, targetSchedule, targetNode);
                    const targetBoard = buildRouteTargetBoard(seed, rulesVersion, floor, targetNode);
                    const targetBoardReport = inspectDungeonBoardTopology(targetBoard);
                    result.checkedRouteTargetBoards += 1;
                    if (targetBoardReport.issues.length > 0) {
                        const issueCodes = targetBoardReport.issues.map((issue) => issue.code);
                        recordIssueCodes(issueCodes);
                        recordContext(result.issueContextCounts, targetSchedule, targetNode);
                        result.issueRouteTargetBoards += 1;
                        result.failures.push({
                            seed,
                            floor: targetNode.floor,
                            scope: 'target_board',
                            targetId,
                            issueCodes,
                            issues: targetBoardReport.issues.map((issue) =>
                                `target=${targetId} ${formatDungeonBoardTopologyIssue(issue, targetBoardReport)}`
                            )
                        });
                    }
                }

                const selectedBranch = selectDungeonNode(revealed, targetId);
                const selectedReport = inspectDungeonRunMapTopology(selectedBranch);
                result.checkedRouteBranches += 1;
                if (selectedReport.issues.length > 0) {
                    const issueCodes = selectedReport.issues.map((issue) => issue.code);
                    recordIssueCodes(issueCodes);
                    recordContext(result.issueContextCounts, schedule);
                    result.issueRouteBranches += 1;
                    result.failures.push({
                        seed,
                        floor,
                        scope: 'selected_branch',
                        targetId,
                        issueCodes,
                        issues: selectedReport.issues.map((issue) =>
                            `selected=${targetId} ${formatDungeonRunMapTopologyIssue(issue, selectedReport)}`
                        )
                    });
                }

                const enteredBranch = enterSelectedDungeonNode(selectedBranch);
                const enteredReport = inspectDungeonRunMapTopology(enteredBranch);
                result.checkedRouteBranches += 1;
                if (enteredReport.issues.length > 0) {
                    const issueCodes = enteredReport.issues.map((issue) => issue.code);
                    recordIssueCodes(issueCodes);
                    recordContext(result.issueContextCounts, schedule);
                    result.issueRouteBranches += 1;
                    result.failures.push({
                        seed,
                        floor,
                        scope: 'entered_branch',
                        targetId,
                        issueCodes,
                        issues: enteredReport.issues.map((issue) =>
                            `entered=${targetId} ${formatDungeonRunMapTopologyIssue(issue, enteredReport)}`
                        )
                    });
                }
            }

            const selected = selectDungeonNode(revealed, routeReport.legalTargetIds[0] ?? '');
            routeState = enterSelectedDungeonNode(selected);
        }
        result.seedSummaries.push({
            seed,
            boardsPassed: floors - seedIssueBoards,
            routesPassed: floors - seedIssueRoutes,
            floors
        });
    }

    if (requireFullScheduleCoverage) {
        const report = getFloorArchetypeProgressionReport(undefined, seeds[0], rulesVersion);
        const expectedMutators = new Set(report.rows.flatMap((row) => row.mutators));
        const coverageChecks: [string, Iterable<string>, Record<string, number>][] = [
            ['floorArchetype', Object.keys(report.archetypeCounts), result.coverageCounts.floorArchetypes],
            ['featuredObjective', Object.keys(report.featuredObjectiveCounts), result.coverageCounts.featuredObjectives],
            ['floorTag', Object.keys(report.floorTagCounts), result.coverageCounts.floorTags],
            ['mutator', expectedMutators, result.coverageCounts.mutators],
            ['routeNodeKind', REQUIRED_ROUTE_NODE_KINDS, result.coverageCounts.routeNodeKinds]
        ];

        for (const [category, expectedKeys, observed] of coverageChecks) {
            for (const key of expectedKeys) {
                if ((observed[key] ?? 0) <= 0) {
                    result.coverageGaps.push(`${category}:${key}`);
                }
            }
        }
    }

    return result;
};

const write = (stream: NodeJS.WriteStream, chunk: string): void => {
    try {
        stream.write(chunk);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EPIPE') {
            throw error;
        }
    }
};

const installBrokenPipeHandler = (): void => {
    const handle = (error: NodeJS.ErrnoException): void => {
        if (error.code === 'EPIPE') {
            process.exit(0);
        }
        throw error;
    };
    process.stdout.on('error', handle);
    process.stderr.on('error', handle);
};

const formatCounts = (counts: Record<string, number>): string =>
    Object.entries(counts)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, count]) => `${key}=${count}`)
        .join(', ');

export const runDungeonTopologyAudit = (argv: readonly string[]): number => {
    const json = boolArg(argv, 'json');
    const quiet = boolArg(argv, 'quiet');
    const maxFailures = Math.max(1, readFlooredNumericCliArg(argv, 'maxFailures', 25));
    const options = parseDungeonTopologyAuditOptions(argv);
    const result = analyzeDungeonTopologyAudit(options);

    if (json) {
        write(process.stdout, `${JSON.stringify(result, null, 2)}\n`);
        if (result.failures.length > 0 || result.coverageGaps.length > 0) {
            return 1;
        }
        return 0;
    }

    if (!quiet) {
        write(process.stdout, `# Dungeon topology audit\n\n`);
        write(process.stdout, `- Floors per seed: ${result.floors}\n`);
        write(process.stdout, `- Rules version: ${result.rulesVersion}\n`);
        write(process.stdout, `- Seeds: ${result.seeds.join(', ')}\n\n`);
        for (const summary of result.seedSummaries) {
            write(
                process.stdout,
                `seed=${summary.seed},topology=${summary.boardsPassed}/${summary.floors},routes=${summary.routesPassed}/${summary.floors}\n`
            );
        }
        write(
            process.stdout,
            `\ncoverage: archetypes=[${formatCounts(result.coverageCounts.floorArchetypes)}] objectives=[${formatCounts(result.coverageCounts.featuredObjectives)}] tags=[${formatCounts(result.coverageCounts.floorTags)}] mutators=[${formatCounts(result.coverageCounts.mutators)}] routeNodeKinds=[${formatCounts(result.coverageCounts.routeNodeKinds)}]\n`
        );
    }

    if (result.coverageGaps.length > 0) {
        write(process.stderr, `\nDungeon topology audit coverage gaps: ${result.coverageGaps.join(', ')}\n`);
    }

    if (result.failures.length > 0) {
        write(
            process.stderr,
            `\nDungeon topology audit failed on ${result.issueBoards}/${result.checkedBoards} board(s), ${result.issueRoutes}/${result.checkedRoutes} route state(s), ${result.issueRouteBranches}/${result.checkedRouteBranches} route branch state(s), and ${result.issueRouteTargetBoards}/${result.checkedRouteTargetBoards} route target board(s):\n` +
                result.failures
                    .slice(0, maxFailures)
                    .map((failure) => `seed=${failure.seed} floor=${failure.floor} ${failure.issues.join('; ')}`)
                    .join('\n') +
                '\n'
        );
        return 1;
    }

    if (result.coverageGaps.length > 0) {
        return 1;
    }

    write(
        process.stdout,
        `\nDungeon topology audit passed (${result.checkedBoards} board(s), ${result.checkedRoutes} route state(s), ${result.checkedRouteBranches} route branch state(s), ${result.checkedRouteTargetBoards} route target board(s))\n`
    );
    return 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    installBrokenPipeHandler();
    process.exitCode = runDungeonTopologyAudit(process.argv.slice(2));
}
