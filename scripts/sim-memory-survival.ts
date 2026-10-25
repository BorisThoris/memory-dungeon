/**
 * How far a player who forgets gets (DGE-005/006, 2026-10-23): the Goldilocks probe's player
 * (`sim-goldilocks.ts`: a working memory of a few cards, the study window seen, what jumps forgotten)
 * playing whole runs with the real miss bank, to the Warden and on into Endless. Run:
 * yarn sim:memory-survival [--seeds 40].
 *
 * Every other survival sim is omniscient with a miss rate (`sim-survival.ts`, the soak), which is the
 * owner's bar (`gate:warden-reach`). This one answers the question those cannot: where does a player
 * with a human-sized memory stop - the Warden's difficulty target (DGE-005) and the Endless rent
 * (DGE-006) were both waiting on it. It measures and reports; it is not a gate, and it tunes nothing.
 */
import { GAME_RULES_VERSION, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase } from '../src/shared/game';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { descendIntoEndless } from '../src/shared/warden-rules';
import { playMemoryFloor } from './sim-goldilocks';
import { actLevelsFor, DESCENT_ACTS } from '../src/shared/floor-mutator-schedule';

export const MEMORY_SURVIVAL_SIZES: readonly number[] = [8, 12, 16, 24];
/** Each act's last floor: 8, 16, 26 and the Warden's 40 on the forty-floor Descent (`descent-length-rules.ts`). */
export const MEMORY_SURVIVAL_REACH_FLOORS: readonly number[] = DESCENT_ACTS.map((act) => actLevelsFor(act, GAME_RULES_VERSION).lastLevel);
export const MEMORY_SURVIVAL_FLOOR_CAP = 120;

export interface MemorySurvivalRow {
    readonly memory: number;
    readonly runs: number;
    readonly medianFloor: number;
    /** Share of runs that stood on each of `MEMORY_SURVIVAL_REACH_FLOORS`. */
    readonly reached: readonly number[];
    readonly wardenCleared: number;
    readonly endReasons: Readonly<Record<string, number>>;
    /** Of the runs that fell the Warden and went on: the median floor Endless ended them on. */
    readonly endlessMedianFloor: number | null;
}

const startRun = (seed: number): RunState => {
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
    return { ...finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed, realm: null })), activeMutators: mutators, board, status: 'playing' };
};

const median = (values: readonly number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
};

export const simulateMemorySurvival = ({ seeds, memory }: { seeds: readonly number[]; memory: number }): MemorySurvivalRow => {
    const floors: number[] = [];
    const endless: number[] = [];
    const endReasons: Record<string, number> = {};
    let wardenCleared = 0;
    for (const seed of seeds) {
        let run = startRun(seed);
        let floor = 1;
        let ended = 'reached the cap';
        while (floor <= MEMORY_SURVIVAL_FLOOR_CAP) {
            run = playMemoryFloor(run, seed, memory).run;
            if (run.status === 'gameOver') {
                ended = run.runEndReason ?? 'gameOver';
                break;
            }
            if (run.status !== 'levelComplete') {
                ended = 'stalled';
                break;
            }
            // The Warden felled: the run goes on into Endless, as a player who descends would.
            if (run.wardenOutcome === 'cleared' && !run.endless) {
                wardenCleared += 1;
                run = descendIntoEndless(run);
            }
            const next = advanceToNextLevel(run);
            if (!next.board || next.board.level === floor) {
                ended = run.status === 'gameOver' ? (run.runEndReason ?? 'gameOver') : 'the floor did not advance';
                break;
            }
            run = finishMemorizePhase(next);
            floor += 1;
        }
        endReasons[ended] = (endReasons[ended] ?? 0) + 1;
        floors.push(floor);
        if (run.endless) endless.push(floor);
    }
    return {
        memory,
        runs: seeds.length,
        medianFloor: median(floors),
        reached: MEMORY_SURVIVAL_REACH_FLOORS.map((at) => floors.filter((reachedFloor) => reachedFloor >= at).length / Math.max(1, seeds.length)),
        wardenCleared,
        endReasons,
        endlessMedianFloor: endless.length > 0 ? median(endless) : null
    };
};

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/sim-memory-survival.ts');
if (isMain) {
    const index = process.argv.indexOf('--seeds');
    const count = index >= 0 ? Number(process.argv[index + 1]) : 40;
    const seeds = Array.from({ length: count }, (_, n) => 77_017 + n * 7919);
    console.log(`memory  runs  median floor  ${MEMORY_SURVIVAL_REACH_FLOORS.map((at) => `reach ${at}`).join('  ')}  Warden felled  Endless median  ends`);
    for (const memory of MEMORY_SURVIVAL_SIZES) {
        const row = simulateMemorySurvival({ seeds, memory });
        console.log(
            `${String(row.memory).padStart(6)}  ${String(row.runs).padStart(4)}  ${String(row.medianFloor).padStart(12)}  ${row.reached.map((share) => share.toFixed(2).padStart(8)).join('  ')}  ${String(row.wardenCleared).padStart(13)}  ${String(row.endlessMedianFloor ?? '-').padStart(14)}  ${JSON.stringify(row.endReasons)}`
        );
    }
}
