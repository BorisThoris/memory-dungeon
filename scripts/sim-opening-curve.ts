/**
 * What does the opening of a run feel like? Run: yarn sim:opening [--check]
 *
 * Nothing measured the first floors as a player meets them: `sim:cascade` reports bands over all
 * floors, `sim:occupancy` reports shares, and neither says how long a floor takes or how that
 * changes as the boards grow. Gen 210 measured it, and two things came out.
 *
 * **Floor 1 is over in 2.3 turns.** Four pairs, and a first match pops half the board, so the first
 * board anyone ever sees ends after two or three flips.
 *
 * **A floor does not get longer as the board grows.** From floor 3 on it is four to five turns
 * whatever its size, because the pop scales with the board: pairs taken by pops go 3.9 to 9.8 while
 * the board goes 7 pairs to 14. At a 35% miss rate the same shape holds - 4.2 turns on floor 3,
 * 7.6 on floor 5, 4.7 on floor 7 - so it is not an artifact of a clean player. The game gets denser
 * rather than longer, which is a design position and not obviously the wrong one; what it is not is
 * what `pair-curve.ts` describes, and until now nobody could see the difference.
 *
 * The bands below are drawn around what was measured, not around what would be nice. They exist so
 * that a change to the pop reach, the pair curve or the par cannot quietly flatten or spike the
 * first floors again - the thing this repository has done twice (Gen 191, Gen 148).
 */
import { GAME_RULES_VERSION, type RunState } from '../src/shared/contracts';
import { buildBoard } from '../src/shared/board-generation';
import { countFindablePairs } from '../src/shared/board-tile-generation-rules';
import { filterMutatorsByContentLock } from '../src/shared/content-lock-state';
import { pickFloorScheduleEntry } from '../src/shared/floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from '../src/shared/game';
import { advanceToNextLevel } from '../src/shared/next-floor-transition-rules';
import { pairsForFloor } from '../src/shared/pair-curve';
import { parTurnsForFloor } from '../src/shared/floor-par';
import { getUnresolvedPlayablePairGroups } from '../src/shared/playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from '../src/shared/rng';
import { isSingletonUtilityPairKey } from '../src/shared/tile-identity';

export const OPENING_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888, 91_919, 1_234] as const;
export const OPENING_FLOORS = 12;

export interface OpeningFloorRow {
    floor: number;
    pairs: number;
    suits: number;
    turns: number;
    par: number;
    poppedPairs: number;
}

export const simulateOpeningCurve = ({
    seeds = OPENING_SEEDS,
    floors = OPENING_FLOORS,
    missRate = 0.15
}: { seeds?: readonly number[]; floors?: number; missRate?: number } = {}): OpeningFloorRow[] => {
    const gathered = new Map<number, { turns: number[]; suits: number[]; popped: number[] }>();
    for (const seed of seeds) {
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
        for (let floor = 1; floor <= floors; floor += 1) {
            const rng = createMulberry32(hashStringToSeed(`opening:${seed}:${floor}:${missRate}`));
            const suits = new Set(run.board!.tiles.map((tile) => tile.suit)).size;
            let turns = 0;
            while (run.status === 'playing' && turns < 80) {
                const groups = getUnresolvedPlayablePairGroups(run.board!).filter((group) =>
                    group.every((tile) => tile.state === 'hidden' || tile.state === 'flipped')
                );
                if (groups.length === 0) break;
                const hidden = run.board!.tiles.filter(
                    (tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey)
                );
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
                run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
                turns += 1;
            }
            const row = gathered.get(floor) ?? { turns: [], suits: [], popped: [] };
            row.turns.push(turns);
            row.suits.push(suits);
            row.popped.push(run.chunkPairsBrokenThisFloor ?? 0);
            gathered.set(floor, row);
            if (run.status !== 'playing') {
                const next = advanceToNextLevel({ ...run, status: 'levelComplete' });
                if (!next.board || next.board.level === floor) break;
                run = finishMemorizePhase(next);
            } else break;
        }
    }
    const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
    return [...gathered.entries()]
        .sort(([a], [b]) => a - b)
        .map(([floor, row]) => ({
            floor,
            pairs: pairsForFloor(floor),
            suits: mean(row.suits),
            turns: mean(row.turns),
            par: parTurnsForFloor(pairsForFloor(floor)),
            poppedPairs: mean(row.popped)
        }));
};

/**
 * The bands, drawn around the measurement (Gen 210). Every floor of the opening has to be playable
 * in a handful of turns and under its par, the first board must not become a slog, and the pop must
 * keep taking a real share of every board - the three ways this opening has actually gone wrong.
 */
export const OPENING_BANDS = {
    /** No floor of the opening may run long: this is a game of short floors, by design. */
    maxTurns: 9,
    /** Nor may one end instantly. Floor 1 sits at 2.3 and is the reason this floor exists. */
    minTurns: 2,
    /** Every floor stays under its par for a clean player, which is what par is for. */
    parHeadroom: 0,
    /** A pop that stops taking pairs is Gen 148 returning; measured 2.0 on floor 1, 9.8 by floor 12. */
    minPoppedPairs: 1.5
} as const;

export const judgeOpeningCurve = (rows: readonly OpeningFloorRow[]): string[] => {
    const issues: string[] = [];
    for (const row of rows) {
        if (row.turns > OPENING_BANDS.maxTurns) {
            issues.push(`floor ${row.floor} takes ${row.turns.toFixed(1)} turns, over ${OPENING_BANDS.maxTurns}`);
        }
        if (row.turns < OPENING_BANDS.minTurns) {
            issues.push(`floor ${row.floor} is over in ${row.turns.toFixed(1)} turns, under ${OPENING_BANDS.minTurns}`);
        }
        if (row.turns > row.par + OPENING_BANDS.parHeadroom) {
            issues.push(`floor ${row.floor} takes ${row.turns.toFixed(1)} turns against a par of ${row.par}`);
        }
        if (row.poppedPairs < OPENING_BANDS.minPoppedPairs) {
            issues.push(`floor ${row.floor} pops ${row.poppedPairs.toFixed(1)} pairs, under ${OPENING_BANDS.minPoppedPairs}`);
        }
    }
    return issues;
};

const main = (): void => {
    const rows = simulateOpeningCurve();
    process.stdout.write('floor  pairs  suits  turns   par  pairs popped\n');
    for (const row of rows) {
        process.stdout.write(
            `  ${String(row.floor).padStart(2)}   ${String(row.pairs).padStart(4)}   ${row.suits.toFixed(1)}  ` +
                `${row.turns.toFixed(1).padStart(5)} ${row.par.toFixed(1).padStart(5)}  ${row.poppedPairs.toFixed(1).padStart(6)}\n`
        );
    }
    const issues = judgeOpeningCurve(rows);
    if (issues.length > 0) {
        process.stdout.write(`\nThe opening moved:\n${issues.map((issue) => `- ${issue}`).join('\n')}\n`);
    }
    if (process.argv.includes('--check')) {
        if (issues.length > 0) {
            process.stderr.write('Opening curve check failed\n');
            process.exitCode = 1;
            return;
        }
        process.stdout.write('\nOpening curve check passed\n');
    }
};

if (process.argv[1]?.includes('sim-opening-curve')) {
    main();
}
