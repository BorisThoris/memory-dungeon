import { buildBoard } from './board-build-rules';
import { resolveChunkBreak } from './chunk-break-rules';
import type { BoardState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

/**
 * Does a match on a real floor actually pop anything?
 *
 * The cascade simulation (`cascade-balance-simulation.ts`) measures what the loop pays over a
 * whole run. It cannot see the thing that made the loop invisible: on generated floors 1 to 6,
 * a match popped nothing at all. Four suits were dealt over floors whose breakable pairs were
 * one or two, so no two of them ever shared a suit, and the dungeon's paired-card budget was
 * the floor's entire pair count, so there was often nothing breakable to share one with.
 *
 * This measures the one number that says the loop is reachable where a player meets it: over
 * every whole pair on a generated floor, the share of matches that would take at least one
 * other pair with them, at chain one - no ladder, no relics, no help.
 *
 * The floors are built through `pickFloorScheduleEntry`, the way a run builds them, so the board
 * carries its tag, archetype, objective and mutators. It did not at first - it asked `buildBoard`
 * for a bare floor - and that is the same mistake one level up as the one this file exists to
 * catch: a measurement taken on a board no player is dealt. Measured both ways the scheduled
 * floors pop at least as often (0.52-1.00 against 0.50-1.00), so the bands did not move; the
 * point is that the number now describes the game.
 */
export interface PopReachFloorSample {
    level: number;
    seed: number;
    wholePairs: number;
    breakablePairs: number;
    suits: number;
    /** Matches tried on this floor, and how many of them popped at least one other pair. */
    matches: number;
    popped: number;
    /** Pairs those matches took with them, summed. */
    poppedPairs: number;
}

export interface PopReachLevelReport {
    level: number;
    floors: number;
    meanWholePairs: number;
    meanSuits: number;
    /** Share of matches on this floor that pop at least one other pair, at chain one. */
    popRate: number;
    /** Mean pairs a match takes with it, at chain one. */
    pairsPerMatch: number;
}

export interface PopReachReport {
    levels: PopReachLevelReport[];
    samples: PopReachFloorSample[];
}

export const POP_REACH_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888] as const;

export const simulatePopReach = (levels = 12, seeds: readonly number[] = POP_REACH_SEEDS): PopReachReport => {
    const samples: PopReachFloorSample[] = [];
    const run = { gameMode: 'endless' as const, floorCurioId: null, relicIds: [] as const };
    for (let level = 1; level <= levels; level += 1) {
        for (const seed of seeds) {
            const schedule = pickFloorScheduleEntry(seed, GAME_RULES_VERSION, level, 'endless');
            const board: BoardState = buildBoard(level, {
                runSeed: seed,
                runRulesVersion: GAME_RULES_VERSION,
                gameMode: 'endless',
                cycleFloor: schedule.cycleFloor,
                floorTag: schedule.floorTag,
                floorArchetypeId: schedule.floorArchetypeId,
                featuredObjectiveId: schedule.featuredObjectiveId,
                activeMutators: schedule.mutators
            });
            const byPair = new Map<string, Tile[]>();
            for (const tile of board.tiles) byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile]);
            const whole = [...byPair.values()].filter((halves) => halves.length === 2);
            let matches = 0;
            let popped = 0;
            let poppedPairs = 0;
            let breakablePairs = 0;
            for (const halves of whole) {
                if (halves.some((half) => half.state !== 'hidden')) continue;
                matches += 1;
                const broke = resolveChunkBreak({ board, run, matchedTileIds: halves.map((half) => half.id), chain: 1 });
                if (broke.brokenPairKeys.length > 0) popped += 1;
                poppedPairs += broke.brokenPairKeys.length;
                if (broke.brokenPairKeys.length > 0 || halves.every((half) => !half.dungeonCardKind)) breakablePairs += 1;
            }
            samples.push({
                level,
                seed,
                wholePairs: whole.length,
                breakablePairs,
                suits: new Set(board.tiles.map((tile) => tile.suit ?? 'none')).size,
                matches,
                popped,
                poppedPairs
            });
        }
    }
    const levelsOut: PopReachLevelReport[] = [];
    for (let level = 1; level <= levels; level += 1) {
        const group = samples.filter((sample) => sample.level === level);
        const matches = group.reduce((sum, sample) => sum + sample.matches, 0);
        levelsOut.push({
            level,
            floors: group.length,
            meanWholePairs: group.reduce((sum, sample) => sum + sample.wholePairs, 0) / Math.max(1, group.length),
            meanSuits: group.reduce((sum, sample) => sum + sample.suits, 0) / Math.max(1, group.length),
            popRate: matches === 0 ? 0 : group.reduce((sum, sample) => sum + sample.popped, 0) / matches,
            pairsPerMatch: matches === 0 ? 0 : group.reduce((sum, sample) => sum + sample.poppedPairs, 0) / matches
        });
    }
    return { levels: levelsOut, samples };
};

/**
 * The bar. A player meets the loop on their first floors or they never believe in it, so the
 * early floors carry the higher floor: this is the check that would have caught floors 1 to 6
 * popping nothing.
 */
export const POP_REACH_BANDS = {
    /** Floors 1-6: a match that takes something with it, at chain one, on this share of tries. */
    earlyFloors: 6,
    earlyPopRate: { min: 0.45 },
    /** Every measured floor, so a late-floor regression cannot hide behind a good early average. */
    overallPopRate: { min: 0.5 },
    /** No floor may be a dead one: every level pops on at least this share. */
    perLevelPopRate: { min: 0.25 }
} as const;

export const judgePopReach = (report: PopReachReport): { ok: boolean; issues: string[] } => {
    const issues: string[] = [];
    const early = report.levels.filter((level) => level.level <= POP_REACH_BANDS.earlyFloors);
    const rate = (rows: PopReachLevelReport[]): number => {
        const samples = report.samples.filter((sample) => rows.some((row) => row.level === sample.level));
        const matches = samples.reduce((sum, sample) => sum + sample.matches, 0);
        return matches === 0 ? 0 : samples.reduce((sum, sample) => sum + sample.popped, 0) / matches;
    };
    const earlyRate = rate(early);
    if (earlyRate < POP_REACH_BANDS.earlyPopRate.min) {
        issues.push(`floors 1-${POP_REACH_BANDS.earlyFloors} popRate ${earlyRate.toFixed(3)} below ${POP_REACH_BANDS.earlyPopRate.min}`);
    }
    const overall = rate(report.levels);
    if (overall < POP_REACH_BANDS.overallPopRate.min) {
        issues.push(`overall popRate ${overall.toFixed(3)} below ${POP_REACH_BANDS.overallPopRate.min}`);
    }
    for (const level of report.levels) {
        if (level.popRate < POP_REACH_BANDS.perLevelPopRate.min) {
            issues.push(`floor ${level.level} popRate ${level.popRate.toFixed(3)} below ${POP_REACH_BANDS.perLevelPopRate.min}`);
        }
    }
    return { ok: issues.length === 0, issues };
};

export const summarizePopReach = (report: PopReachReport): string =>
    report.levels
        .map(
            (level) =>
                `floor ${String(level.level).padStart(2)}: pairs=${level.meanWholePairs.toFixed(1)} suits=${level.meanSuits.toFixed(1)} ` +
                `popRate=${level.popRate.toFixed(2)} pairsPerMatch=${level.pairsPerMatch.toFixed(2)}`
        )
        .join('\n');
