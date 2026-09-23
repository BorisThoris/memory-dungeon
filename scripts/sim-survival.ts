/**
 * How long does a run survive the miss bank? Run: yarn sim:survival [--rates 0.1,0.15,0.2] [--seeds 20]
 *
 * Every other census holds the bank open (`missBank: undefined`) because it measures the floor;
 * this one is the only reading of the run. A perfect-memory player who misses a flip at a fixed
 * rate plays the scheduled floors until the bank ends the run or the cap is reached, and the
 * report is the median floor reached per miss rate - the table at the constants in `miss-bank.ts`
 * was made with it. Optional columns say where the misses came from: how many the chain earned,
 * how many a floor clear earned, how many expired unspent.
 *
 * The script used to live in a session scratchpad and was rebuilt twice; it is a repo script now
 * so the next tuning starts from the same measurement as the last one.
 */
import { GAME_RULES_VERSION, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { comboMissesEarned, MISS_BANK_FLOOR_GRANT, missesLeft } from '../src/shared/miss-bank';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { isSingletonUtilityPairKey } from '../src/shared/tile-identity';

export const SURVIVAL_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888, 91_919, 1_234, 13, 27, 314, 2718, 42, 99, 1001, 4096, 65_537, 7] as const;
export const SURVIVAL_FLOOR_CAP = 60;
export const SURVIVAL_RATES = [0.1, 0.15, 0.2, 0.25, 0.35] as const;

export interface SurvivalRun {
    floorReached: number;
    comboEarned: number;
    clearEarned: number;
    expired: number;
}

export const simulateSurvivalRun = (seed: number, missRate: number, floorCap = SURVIVAL_FLOOR_CAP): SurvivalRun => {
    const entry = pickFloorScheduleEntry(seed, GAME_RULES_VERSION, 1, 'endless');
    const mutators = filterMutatorsByContentLock(entry.mutators);
    const board = buildBoard(1, {
        runSeed: seed,
        runRulesVersion: GAME_RULES_VERSION,
        gameMode: 'endless',
        activeMutators: mutators,
        floorTag: entry.floorTag,
        floorArchetypeId: entry.floorArchetypeId,
        featuredObjectiveId: entry.featuredObjectiveId,
        cycleFloor: entry.cycleFloor
    });
    let run: RunState = {
        ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed })),
        activeMutators: mutators,
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };
    const tally: SurvivalRun = { floorReached: 1, comboEarned: 0, clearEarned: 0, expired: 0 };
    for (let floor = 1; floor <= floorCap; floor += 1) {
        tally.floorReached = floor;
        const rng = createMulberry32(hashStringToSeed(`survival:${seed}:${floor}:${missRate}`));
        let turns = 0;
        while (run.status === 'playing' && turns < 120) {
            const groups = getUnresolvedPlayablePairGroups(run.board!).filter((group) =>
                group.every((tile) => tile.state === 'hidden' || tile.state === 'flipped')
            );
            if (groups.length === 0) break;
            const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));
            const wantsMiss = rng() < missRate && hidden.length >= 3;
            let first;
            let second;
            if (wantsMiss) {
                first = hidden[pickRngIndex(rng, hidden.length)]!;
                const others = hidden.filter((tile) => tile.pairKey !== first!.pairKey);
                if (others.length === 0) break;
                second = others[pickRngIndex(rng, others.length)]!;
            } else {
                const group = groups[pickRngIndex(rng, groups.length)]!;
                [first, second] = [group[0]!, group[1]!];
            }
            const before = run;
            run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
            tally.comboEarned += comboMissesEarned(before.stats.currentStreak, run.stats.currentStreak);
            turns += 1;
        }
        if (run.status === 'gameOver') break;
        if (run.status !== 'levelComplete' && run.status !== 'playing') break;
        const leftBefore = missesLeft(run) ?? 0;
        const next = advanceToNextLevel({ ...run, status: 'levelComplete' });
        if (!next.board || next.board.level === floor) break;
        const leftAfter = missesLeft(next) ?? 0;
        // What the clear paid in, less what the shelf and the cap took away.
        const delta = leftAfter - leftBefore;
        tally.clearEarned += MISS_BANK_FLOOR_GRANT;
        tally.expired += Math.max(0, MISS_BANK_FLOOR_GRANT - delta);
        run = finishMemorizePhase(next);
    }
    return tally;
};

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
};
const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

export interface SurvivalRow {
    missRate: number;
    medianFloor: number;
    meanFloor: number;
    minFloor: number;
    comboEarnedPerFloor: number;
    expiredPerFloor: number;
}

export const simulateSurvival = ({
    rates = SURVIVAL_RATES,
    seeds = SURVIVAL_SEEDS,
    floorCap = SURVIVAL_FLOOR_CAP
}: { rates?: readonly number[]; seeds?: readonly number[]; floorCap?: number } = {}): SurvivalRow[] =>
    rates.map((missRate) => {
        const runs = seeds.map((seed) => simulateSurvivalRun(seed, missRate, floorCap));
        const floors = runs.map((run) => run.floorReached);
        return {
            missRate,
            medianFloor: median(floors),
            meanFloor: mean(floors),
            minFloor: Math.min(...floors),
            comboEarnedPerFloor: mean(runs.map((run) => run.comboEarned / run.floorReached)),
            expiredPerFloor: mean(runs.map((run) => run.expired / run.floorReached))
        };
    });

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/sim-survival.ts');
if (isMain) {
    const arg = (name: string): string | undefined => {
        const index = process.argv.indexOf(`--${name}`);
        return index >= 0 ? process.argv[index + 1] : undefined;
    };
    const rates = arg('rates')?.split(',').map(Number) ?? SURVIVAL_RATES;
    const seedCount = Number(arg('seeds') ?? SURVIVAL_SEEDS.length);
    const rows = simulateSurvival({ rates, seeds: SURVIVAL_SEEDS.slice(0, seedCount) });
    console.log('miss   median  mean   min   combo/floor  expired/floor');
    for (const row of rows) {
        console.log(
            `${(row.missRate * 100).toFixed(0).padStart(3)}%   ${String(row.medianFloor).padStart(5)}  ${row.meanFloor
                .toFixed(1)
                .padStart(5)}  ${String(row.minFloor).padStart(4)}   ${row.comboEarnedPerFloor.toFixed(2).padStart(9)}    ${row.expiredPerFloor
                .toFixed(2)
                .padStart(10)}`
        );
    }
}
