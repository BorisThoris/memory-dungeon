/**
 * REF-098: Fast, deterministic endless schedule sampler (mutator / floor-tag counts).
 * Run: yarn sim:endless [--floors=10000] [--seed=42]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, type FindableKind } from '../src/shared/contracts';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { buildBoard } from '../src/shared/board-generation';
import { getBoardTraitInteractionPreviewLines } from '../src/shared/tile-trait-rules';

const numArg = (argv: readonly string[], name: string, def: number): number => {
    const raw = argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
    return raw != null ? Number(raw) : def;
};

export interface EndlessSimulationCsvInput {
    floors: number;
    runSeed: number;
    rulesVersion?: number;
}

export interface EndlessSimulationHealthReport {
    ok: boolean;
    issues: string[];
    metrics: {
        deadTraitFloors: number;
        exitlessFloors: number;
        exitLockTypes: number;
        findableTotal: number;
        objectiveKinds: number;
        rewardKinds: number;
        routeKinds: number;
        traitFloorShare: number;
        traitInteractionLines: number;
    };
}

type EndlessSimulationHealthMetrics = EndlessSimulationHealthReport['metrics'];

const emptyFindableKindCounts = (): Record<FindableKind, number> => ({
    shard_spark: 0,
    score_glint: 0,
    ward_spark: 0,
    scout_glint: 0
});

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
    const traitMetricCounts: Record<string, number> = {
        traitFloors: 0,
        traitInteractionLines: 0,
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
        dungeonExitCounts[String(exits.length)] = (dungeonExitCounts[String(exits.length)] ?? 0) + 1;
        for (const exit of exits) {
            const lockKey = exit.dungeonExitLockKind ?? 'none';
            dungeonExitLockCounts[lockKey] = (dungeonExitLockCounts[lockKey] ?? 0) + 1;
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
        if (traitPairKeys.size > 0) {
            traitMetricCounts.traitFloors += 1;
            traitMetricCounts.traitInteractionLines += traitInteractionLines;
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
        ...Object.entries(FINDABLE_KIND_SPAWN_WEIGHTS)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `findableTargetWeight,${k},${v}`),
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
            .map(([k, v]) => `dungeonExitLock,${k},${v}`)
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
    const findableTotal = sumCounts(counts.findableKind);
    const rewardKinds = Object.keys(counts.findableKind ?? {}).filter((key) => (counts.findableKind?.[key] ?? 0) > 0).length;
    const traitFloors = counts.traitMetric?.traitFloors ?? 0;
    const deadTraitFloors = counts.traitMetric?.deadTraitFloors ?? 0;
    const traitInteractionLines = counts.traitMetric?.traitInteractionLines ?? 0;
    return {
        deadTraitFloors,
        exitlessFloors: counts.dungeonExitCount?.['0'] ?? 0,
        exitLockTypes,
        findableTotal,
        objectiveKinds,
        rewardKinds,
        routeKinds,
        traitFloorShare: traitFloors / floors,
        traitInteractionLines
    };
};

export const evaluateEndlessSimulationHealth = (
    metrics: EndlessSimulationHealthMetrics,
    floors: number,
    expectedRewardKinds = Object.keys(FINDABLE_KIND_SPAWN_WEIGHTS).length
): EndlessSimulationHealthReport => {
    const safeFloors = Math.max(1, Math.floor(floors));
    const issues = [
        metrics.routeKinds < 8 ? `Expected at least 8 floor archetypes, saw ${metrics.routeKinds}.` : null,
        metrics.objectiveKinds < 4 ? `Expected at least 4 dungeon objectives, saw ${metrics.objectiveKinds}.` : null,
        metrics.exitLockTypes < 2 ? `Expected at least 2 nontrivial exit lock types, saw ${metrics.exitLockTypes}.` : null,
        metrics.exitlessFloors > 0 ? `Expected every sampled floor to have an exit, saw ${metrics.exitlessFloors} exitless floors.` : null,
        metrics.rewardKinds < expectedRewardKinds
            ? `Expected all ${expectedRewardKinds} findable reward kinds, saw ${metrics.rewardKinds}.`
            : null,
        metrics.findableTotal < Math.floor(safeFloors * 0.5)
            ? `Expected at least one findable reward per two floors, saw ${metrics.findableTotal} across ${safeFloors} floors.`
            : null,
        metrics.traitFloorShare < 0.8
            ? `Expected trait floors on at least 80.0% of floors, saw ${(metrics.traitFloorShare * 100).toFixed(1)}%.`
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

export const buildEndlessSimulationSummary = (input: EndlessSimulationCsvInput): string => {
    const metrics = readEndlessSimulationMetrics(input);
    const floors = Math.max(1, Math.floor(input.floors));
    const pct = (value: number) => `${((value / floors) * 100).toFixed(1)}%`;

    return [
        '# Endless Simulation Gate Summary',
        '',
        `- Floors sampled: ${floors}`,
        `- Seed: ${Math.floor(input.runSeed)}`,
        `- Rules version: ${input.rulesVersion ?? GAME_RULES_VERSION}`,
        `- Route gates: ${metrics.routeKinds} floor archetypes, ${metrics.objectiveKinds} objectives, ${metrics.exitLockTypes} exit lock types, ${metrics.exitlessFloors} exitless floors.`,
        `- Reward gates: ${metrics.findableTotal} findable rewards across ${metrics.rewardKinds} active reward kinds.`,
        `- Trait gates: ${Math.round(metrics.traitFloorShare * floors)} trait floors (${pct(metrics.traitFloorShare * floors)}), ${metrics.traitInteractionLines} interaction lines, ${metrics.deadTraitFloors} dead trait floors.`,
        ''
    ].join('\n');
};

const runCli = (argv: readonly string[]): void => {
    const floors = Math.max(1, Math.floor(numArg(argv, 'floors', 10_000)));
    const runSeed = Math.floor(numArg(argv, 'seed', 42_001));
    const input = { floors, runSeed };
    const summaryMode = argv.includes('--summary');
    const checkMode = argv.includes('--check');
    const output = summaryMode || checkMode ? buildEndlessSimulationSummary(input) : buildEndlessSimulationCsv(input);
    process.stdout.write(output);
    if (checkMode) {
        const health = analyzeEndlessSimulationHealth(input);
        if (health.ok) {
            process.stdout.write('Endless simulation health check passed\n');
        } else {
            process.stderr.write(`Endless simulation health check failed:\n${health.issues.map((issue) => `- ${issue}`).join('\n')}\n`);
            process.exitCode = 1;
        }
    }

    const out = argv.find((a) => a.startsWith('--out='))?.split('=')[1];
    if (out) {
        writeFileSync(out, output, 'utf8');
    }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    runCli(process.argv.slice(2));
}
