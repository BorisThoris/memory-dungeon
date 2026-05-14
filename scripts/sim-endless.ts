/**
 * REF-098: Fast, deterministic endless schedule sampler (mutator / floor-tag counts).
 * Run: yarn sim:endless [--floors=10000] [--seed=42]
 */
import { writeFileSync } from 'node:fs';
import { FINDABLE_KIND_SPAWN_WEIGHTS, GAME_RULES_VERSION, type FindableKind } from '../src/shared/contracts';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { buildBoard } from '../src/shared/board-generation';

const argv = process.argv.slice(2);
const numArg = (name: string, def: number): number => {
    const raw = argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
    return raw != null ? Number(raw) : def;
};

const floors = Math.max(1, Math.floor(numArg('floors', 10_000)));
const runSeed = Math.floor(numArg('seed', 42_001));

const mutatorCounts: Record<string, number> = {};
const floorTagCounts: Record<string, number> = {};
const floorArchetypeCounts: Record<string, number> = {};
const objectiveCounts: Record<string, number> = {};
const bossCounts: Record<string, number> = {};
const dungeonCardKindCounts: Record<string, number> = {};
const dungeonExitLockCounts: Record<string, number> = {};
const dungeonExitCounts: Record<string, number> = {};
const findableKindCounts: Record<FindableKind, number> = {
    shard_spark: 0,
    score_glint: 0,
    ward_spark: 0,
    scout_glint: 0
};

for (let level = 1; level <= floors; level++) {
    const { mutators, floorTag, floorArchetypeId, featuredObjectiveId, cycleFloor } = pickFloorScheduleEntry(
        runSeed,
        GAME_RULES_VERSION,
        level,
        'endless'
    );
    floorTagCounts[floorTag] = (floorTagCounts[floorTag] ?? 0) + 1;
    floorArchetypeCounts[floorArchetypeId ?? 'none'] = (floorArchetypeCounts[floorArchetypeId ?? 'none'] ?? 0) + 1;
    for (const m of mutators) {
        mutatorCounts[m] = (mutatorCounts[m] ?? 0) + 1;
    }
    const board = buildBoard(level, {
        runSeed,
        runRulesVersion: GAME_RULES_VERSION,
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
    for (const tile of board.tiles) {
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

const csv = lines.join('\n') + '\n';
process.stdout.write(csv);

const out = argv.find((a) => a.startsWith('--out='))?.split('=')[1];
if (out) {
    writeFileSync(out, csv, 'utf8');
}
