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

const runCli = (argv: readonly string[]): void => {
    const floors = Math.max(1, Math.floor(numArg(argv, 'floors', 10_000)));
    const runSeed = Math.floor(numArg(argv, 'seed', 42_001));
    const csv = buildEndlessSimulationCsv({ floors, runSeed });
    process.stdout.write(csv);

    const out = argv.find((a) => a.startsWith('--out='))?.split('=')[1];
    if (out) {
        writeFileSync(out, csv, 'utf8');
    }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    runCli(process.argv.slice(2));
}
