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
 *
 * `--items` (2026-10-19) lets the player use the curio items a run finds (`curio-rules.ts`): take
 * the Miser's Purse, ring the Still Bell and break the Storm Glass at the top of a turn whenever
 * they would act, and melt the first card turned with the Crucible when it can. It answers what the
 * items do to a run's length; without it the table is the one the miss bank was tuned against.
 */
import { automaticCampReward } from '../src/shared/automatic-camp-rules';
import { turnTripleThird } from '../src/shared/match-rule-rules';
import { GAME_RULES_VERSION, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { studyWithFlurry } from '../src/shared/flurry-rules';
import { comboMissesEarned, MISS_BANK_FLOOR_GRANT, missesLeft } from '../src/shared/miss-bank';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { isSingletonUtilityPairKey } from '../src/shared/tile-identity';
import { orderAroundLock } from '../src/shared/turn-match-board-cleanup-rules';
import { applyCrucible, crucibleTargetTileId } from '../src/shared/crucible-rules';
import { canTakeMisersPurse, takeMisersPurse } from '../src/shared/misers-purse-rules';
import { applyStillBell, canRingStillBell } from '../src/shared/still-bell-rules';
import { applyStormGlass, canBreakStormGlass } from '../src/shared/storm-glass-rules';
import { descentLengthFor } from '../src/shared/descent-length-rules';

/** The curio items a player who uses them would use before turning a card, or the run unchanged. */
const useItemsAtTurnStart = (run: RunState): RunState => {
    let next = run;
    if (canTakeMisersPurse(next)) next = takeMisersPurse(next) ?? next;
    if (canRingStillBell(next)) next = applyStillBell(next)?.run ?? next;
    if (canBreakStormGlass(next)) next = applyStormGlass(next)?.run ?? next;
    return next;
};

/** Both cards of the turn, the locked one second (`orderAroundLock`). */
const flipLockedLast = (run: RunState, first: { id: string }, second: { id: string }): RunState => {
    const [a, b] = orderAroundLock(run, first, second);
    return flipTile(flipTile(run, a.id), b.id);
};

export const SURVIVAL_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888, 91_919, 1_234, 13, 27, 314, 2718, 42, 99, 1001, 4096, 65_537, 7] as const;
/** The Warden gate’s sample (DGE-032): the twenty above and eighty more, so a share of runs is not one seed’s luck. */
export const SURVIVAL_GATE_SEEDS: readonly number[] = [...SURVIVAL_SEEDS, ...Array.from({ length: 80 }, (_, index) => 200_003 + index * 7919)];
/** To the Warden: floor 40 from rules 93 (`descent-length-rules.ts`), 60 before. */
export const SURVIVAL_FLOOR_CAP = descentLengthFor(GAME_RULES_VERSION);
export const SURVIVAL_RATES = [0.1, 0.15, 0.2, 0.25, 0.35] as const;

export interface SurvivalRun {
    floorReached: number;
    comboEarned: number;
    clearEarned: number;
    expired: number;
    /** How the run met the Warden on floor 60 (`warden-rules.ts`), or null if it never got there. */
    warden: 'cleared' | 'fell' | null;
}

export const simulateSurvivalRun = (seed: number, missRate: number, floorCap = SURVIVAL_FLOOR_CAP, useItems = false, depth = 0): SurvivalRun => {
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
        ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed, realm: null, depth })),
        activeMutators: mutators,
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles)
    };
    const tally: SurvivalRun = { floorReached: 1, comboEarned: 0, clearEarned: 0, expired: 0, warden: null };
    for (let floor = 1; floor <= floorCap; floor += 1) {
        tally.floorReached = floor;
        const rng = createMulberry32(hashStringToSeed(`survival:${seed}:${floor}:${missRate}`));
        let turns = 0;
        while (run.status === 'playing' && turns < 120) {
            if (useItems) run = useItemsAtTurnStart(run);
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
            if (useItems && (run.crucibleCharges ?? 0) > 0) {
                // Turn the first card; if the crucible can melt it, it does, and the turn ends there.
                const opened = flipTile(run, first.id);
                const melted = crucibleTargetTileId(opened) === first.id ? applyCrucible(opened, first.id) : null;
                if (melted) {
                    run = melted.run;
                    turns += 1;
                    continue;
                }
            }
            run = resolveBoardTurn(turnTripleThird(flipLockedLast(run, first, second), flipTile));
            tally.comboEarned += comboMissesEarned(before.stats.currentStreak, run.stats.currentStreak);
            turns += 1;
        }
        tally.warden = run.wardenOutcome ?? tally.warden;
        if (run.status === 'gameOver') break;
        if (run.status !== 'levelComplete' && run.status !== 'playing') break;
        const leftBefore = missesLeft(run) ?? 0;
        // From rules 100 nothing buys at the stop but the player: this one buys the way the camp did.
        const next = advanceToNextLevel(automaticCampReward({ ...run, status: 'levelComplete' }).run);
        if (!next.board || next.board.level === floor) break;
        const leftAfter = missesLeft(next) ?? 0;
        // What the clear paid in, less what the shelf and the cap took away.
        const delta = leftAfter - leftBefore;
        tally.clearEarned += MISS_BANK_FLOOR_GRANT;
        tally.expired += Math.max(0, MISS_BANK_FLOOR_GRANT - delta);
        run = studyWithFlurry(next, createMulberry32(hashStringToSeed(`flurry:${seed}:${floor}:${missRate}`)), missRate);
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
    /** Runs that cleared the Warden, and runs that fell on its floor. */
    wardenCleared: number;
    wardenFell: number;
}

export const simulateSurvival = ({
    rates = SURVIVAL_RATES,
    seeds = SURVIVAL_SEEDS,
    floorCap = SURVIVAL_FLOOR_CAP,
    useItems = false,
    depth = 0
}: { rates?: readonly number[]; seeds?: readonly number[]; floorCap?: number; useItems?: boolean; depth?: number } = {}): SurvivalRow[] =>
    rates.map((missRate) => {
        const runs = seeds.map((seed) => simulateSurvivalRun(seed, missRate, floorCap, useItems, depth));
        const floors = runs.map((run) => run.floorReached);
        return {
            missRate,
            medianFloor: median(floors),
            meanFloor: mean(floors),
            minFloor: Math.min(...floors),
            comboEarnedPerFloor: mean(runs.map((run) => run.comboEarned / run.floorReached)),
            expiredPerFloor: mean(runs.map((run) => run.expired / run.floorReached)),
            wardenCleared: runs.filter((run) => run.warden === 'cleared').length,
            wardenFell: runs.filter((run) => run.warden === 'fell').length
        };
    });

/**
 * DGE-032's first bar, set by the owner on 2026-10-21: at 15% misses at least half of runs reach the
 * Warden (floor 60), and a run at 10% clears it. `yarn gate:warden-reach` fails when either does not hold.
 */
export const WARDEN_REACH_MISS_RATE = 0.15;
export const WARDEN_REACH_MIN_SHARE = 0.5;
export const WARDEN_CLEAN_MISS_RATE = 0.1;

export const judgeWardenReach = (rows: readonly { missRate: number; wardenCleared: number; wardenFell: number }[], seeds: number): string[] => {
    const issues: string[] = [];
    const at = (rate: number) => rows.find((row) => Math.abs(row.missRate - rate) < 1e-9);
    const average = at(WARDEN_REACH_MISS_RATE);
    const clean = at(WARDEN_CLEAN_MISS_RATE);
    if (!average || !clean) return ['the survival sample is missing the 10% or the 15% player'];
    const reached = (average.wardenCleared + average.wardenFell) / Math.max(1, seeds);
    if (reached < WARDEN_REACH_MIN_SHARE) issues.push(`at 15% misses ${(reached * 100).toFixed(0)}% of runs reach the Warden, under ${WARDEN_REACH_MIN_SHARE * 100}%`);
    if (clean.wardenCleared === 0) issues.push('no run at 10% misses clears the Warden');
    return issues;
};

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/sim-survival.ts');
if (isMain) {
    const arg = (name: string): string | undefined => {
        const index = process.argv.indexOf(`--${name}`);
        return index >= 0 ? process.argv[index + 1] : undefined;
    };
    const rates = arg('rates')?.split(',').map(Number) ?? SURVIVAL_RATES;
    const seedCount = Number(arg('seeds') ?? SURVIVAL_SEEDS.length);
    const useItems = process.argv.includes('--items');
    // The Depths (`depth-rules.ts`): `--depth n` plays every run at Depth n; the gate plays Depth 0.
    const depth = Number(arg('depth') ?? 0);
    const rows = simulateSurvival({ rates, seeds: SURVIVAL_GATE_SEEDS.slice(0, seedCount), useItems, depth });
    if (process.argv.includes('--check')) {
        const issues = judgeWardenReach(rows, Math.min(seedCount, SURVIVAL_GATE_SEEDS.length));
        for (const issue of issues) console.error(issue);
        if (issues.length > 0) process.exit(1);
    }
    console.log(`${useItems ? 'with the curio items used' : 'without items'}${depth > 0 ? `, at Depth ${depth}` : ''}`);
    console.log('miss   median  mean   min   combo/floor  expired/floor  warden cleared/fell');
    for (const row of rows) {
        console.log(
            `${(row.missRate * 100).toFixed(0).padStart(3)}%   ${String(row.medianFloor).padStart(5)}  ${row.meanFloor
                .toFixed(1)
                .padStart(5)}  ${String(row.minFloor).padStart(4)}   ${row.comboEarnedPerFloor.toFixed(2).padStart(9)}    ${row.expiredPerFloor
                .toFixed(2)
                .padStart(10)}     ${row.wardenCleared}/${row.wardenFell}`
        );
    }
}
