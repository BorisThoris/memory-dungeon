import type { BoardState, Rating, RunState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { countFindablePairs } from './board-tile-generation-rules';
import { runChainTier } from './chain-tier-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import {
    activateDungeonExit,
    createNewRun,
    finishMemorizePhase,
    flipTile,
    resolveBoardTurn,
    revealDungeonExit
} from './game';
import { getPrimaryPlaythroughExitTile, getUnresolvedPlayablePairGroups } from './playthrough-solver-rules';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey } from './tile-identity';
import { calculateRating } from './scoring-rules';

/**
 * The cascade, measured rather than felt.
 *
 * The design (docs/CHAIN_CHUNK_FEVER_DESIGN.md §5) names one risk above the others: cascades
 * remove pairs the player never recalled, so they could quietly trivialise the memory game. This
 * plays generated endless floors with a player who misses a stated share of their turns and
 * records what the chain actually buys them — how fast the floor clears, how much of the score
 * came from chunks, how often Fever arrives — and what it must never buy them: a better rating.
 *
 * Rating is a function of mistakes and nothing else. A chain player and a recall player with the
 * same mistakes post the same rating; the chain player gets there faster and louder. The bands
 * below state the shape that should hold and `assertCascadeBalanceWithinBands` says when it stops
 * holding, so the constants in `chunk-break-rules.ts` are tuned against a report, not a hunch.
 */
export interface CascadeBalanceFloorSample {
    seed: number;
    floor: number;
    missRate: number;
    cleared: boolean;
    /** The run died on this floor; not cleared, but not stuck either. */
    fell: boolean;
    turns: number;
    mistakes: number;
    rating: Rating;
    ratingFromMistakes: Rating;
    levelScore: number;
    /** Score the chunks paid, read from the run's own ledger (`chunkScoreThisFloor`). */
    chunkScore: number;
    chunkBreaks: number;
    chunkPairs: number;
    feverBreaks: number;
    bestChain: number;
    comboShardsGained: number;
    pairsOnFloor: number;
}

export interface CascadeBalanceBandReport {
    missRate: number;
    floors: number;
    clearedShare: number;
    /** Floors that ended cleared or in a death; anything else is a floor that got stuck. */
    settledShare: number;
    meanTurns: number;
    meanMistakes: number;
    meanLevelScore: number;
    /** Chunk score over level score, over floors that had a chunk at all. */
    chunkShareOfScore: number;
    chunkBreaksPerFloor: number;
    chunkPairsPerFloor: number;
    feverFloorShare: number;
    ratingCounts: Record<Rating, number>;
    /** Floors where the rating differed from `calculateRating(mistakes)`; must be zero. */
    ratingDriftFloors: number;
}

export interface CascadeBalanceReport {
    rulesVersion: number;
    seeds: number[];
    floors: number[];
    bands: CascadeBalanceBandReport[];
    samples: CascadeBalanceFloorSample[];
}

export interface CascadeBalanceSimulationInput {
    seeds: readonly number[];
    /** Floor numbers to play; each is a fresh run at that level, like the softlock solver. */
    floors: readonly number[];
    missRates: readonly number[];
    rulesVersion?: number;
}

const EMPTY_RATINGS = (): Record<Rating, number> => ({ 'S++': 0, S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 });

const hiddenTilesOf = (board: BoardState): Tile[] => board.tiles.filter((tile) => tile.state === 'hidden');

/**
 * One floor, one player. A miss is a real mismatch — two hidden tiles from different pairs — so
 * the chain drops the way it does for a person, and the magpie and every mismatch rule fire.
 */
export const playCascadeBalanceFloor = ({
    seed,
    floor,
    missRate,
    rulesVersion = GAME_RULES_VERSION,
    maxTurns = 240
}: {
    seed: number;
    floor: number;
    missRate: number;
    rulesVersion?: number;
    maxTurns?: number;
}): CascadeBalanceFloorSample => {
    const schedule = pickFloorScheduleEntry(seed, rulesVersion, floor, 'endless');
    const board = buildBoard(floor, {
        runSeed: seed,
        runRulesVersion: rulesVersion,
        floorTag: schedule.floorTag,
        floorArchetypeId: schedule.floorArchetypeId,
        featuredObjectiveId: schedule.featuredObjectiveId,
        cycleFloor: schedule.cycleFloor,
        gameMode: 'endless',
        activeMutators: schedule.mutators
    });
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: seed }));
    let run: RunState = { ...base, board, status: 'playing', findablesTotalThisFloor: countFindablePairs(board.tiles) };
    const rng = createMulberry32(hashStringToSeed(`cascade-sim:${seed}:${floor}:${missRate}:${rulesVersion}`));
    const shardsAtStart = runNonNegativeInteger(run.stats.comboShards);

    let turns = 0;
    let feverBreaks = 0;
    let bestChain = 0;
    const pairsOnFloor = board.pairCount;

    while (run.status === 'playing' && turns < maxTurns) {
        // A half the last turn left face up is still a pair to finish, so the group only needs
        // its tiles to be on the board and unmatched, not all face down.
        const groups = getUnresolvedPlayablePairGroups(run.board!).filter((group) =>
            group.every((tile) => tile.state === 'hidden' || tile.state === 'flipped')
        );
        if (groups.length === 0) {
            break;
        }
        // A miss is a wrong pair, not a wrong room: the shop and the exit are singletons a player
        // flips on purpose, and flipping one opens a screen this loop is not playing.
        const hidden = hiddenTilesOf(run.board!).filter((tile) => !isSingletonUtilityPairKey(tile.pairKey));
        const wantsMiss = rng() < missRate && hidden.length >= 3;
        let first: Tile;
        let second: Tile;
        if (wantsMiss) {
            first = hidden[pickRngIndex(rng, hidden.length)]!;
            const others = hidden.filter((tile) => tile.pairKey !== first.pairKey);
            if (others.length === 0) {
                break;
            }
            second = others[pickRngIndex(rng, others.length)]!;
        } else {
            const group = groups[pickRngIndex(rng, groups.length)]!;
            first = group[0]!;
            second = group[1]!;
        }
        const before = run;
        run = resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
        turns += 1;
        const chain = runNonNegativeInteger(run.stats.currentStreak);
        bestChain = Math.max(bestChain, chain);
        const pairsBroken = runNonNegativeInteger(run.chunkPairsBrokenThisFloor) - runNonNegativeInteger(before.chunkPairsBrokenThisFloor);
        if (pairsBroken > 0 && runChainTier(run) === 'fever') {
            feverBreaks += 1;
        }
    }
    if (run.status === 'playing') {
        const exit = getPrimaryPlaythroughExitTile(run.board!);
        if (exit) {
            run = activateDungeonExit(revealDungeonExit(run, exit.id));
        }
    }
    const cleared = run.status === 'levelComplete';
    const fell = run.status === 'gameOver';
    // Mistakes are what the game counted, not what this loop tried to do: a miss a guard token
    // absorbed is still a miss the rating sees, and the grace rules decide what a try is.
    const mistakes = runNonNegativeInteger(run.lastLevelResult?.mistakes ?? run.stats.tries);
    const rating: Rating = run.lastLevelResult?.rating ?? run.stats.rating;
    return {
        seed,
        floor,
        missRate,
        cleared,
        fell,
        turns,
        mistakes,
        rating,
        ratingFromMistakes: calculateRating(mistakes),
        levelScore: runNonNegativeInteger(run.lastLevelResult?.scoreGained ?? run.stats.currentLevelScore),
        chunkScore: runNonNegativeInteger(run.chunkScoreThisFloor),
        chunkBreaks: runNonNegativeInteger(run.chunkBreaksThisFloor),
        chunkPairs: runNonNegativeInteger(run.chunkPairsBrokenThisFloor),
        feverBreaks,
        bestChain,
        comboShardsGained: Math.max(0, runNonNegativeInteger(run.stats.comboShards) - shardsAtStart),
        pairsOnFloor
    };
};

const summarizeBand = (missRate: number, samples: CascadeBalanceFloorSample[]): CascadeBalanceBandReport => {
    const floors = samples.length;
    const mean = (pick: (sample: CascadeBalanceFloorSample) => number): number =>
        floors === 0 ? 0 : samples.reduce((sum, sample) => sum + pick(sample), 0) / floors;
    const withChunks = samples.filter((sample) => sample.chunkPairs > 0 && sample.levelScore > 0);
    const ratingCounts = EMPTY_RATINGS();
    for (const sample of samples) {
        ratingCounts[sample.rating] += 1;
    }
    return {
        missRate,
        floors,
        clearedShare: mean((sample) => (sample.cleared ? 1 : 0)),
        settledShare: mean((sample) => (sample.cleared || sample.fell ? 1 : 0)),
        meanTurns: mean((sample) => sample.turns),
        meanMistakes: mean((sample) => sample.mistakes),
        meanLevelScore: mean((sample) => sample.levelScore),
        chunkShareOfScore:
            withChunks.length === 0
                ? 0
                : withChunks.reduce((sum, sample) => sum + sample.chunkScore / sample.levelScore, 0) / withChunks.length,
        chunkBreaksPerFloor: mean((sample) => sample.chunkBreaks),
        chunkPairsPerFloor: mean((sample) => sample.chunkPairs),
        feverFloorShare: mean((sample) => (sample.feverBreaks > 0 ? 1 : 0)),
        ratingCounts,
        ratingDriftFloors: samples.filter((sample) => sample.rating !== sample.ratingFromMistakes).length
    };
};

export const runCascadeBalanceSimulation = ({
    seeds,
    floors,
    missRates,
    rulesVersion = GAME_RULES_VERSION
}: CascadeBalanceSimulationInput): CascadeBalanceReport => {
    const samples: CascadeBalanceFloorSample[] = [];
    for (const missRate of missRates) {
        for (const seed of seeds) {
            for (const floor of floors) {
                samples.push(playCascadeBalanceFloor({ seed, floor, missRate, rulesVersion }));
            }
        }
    }
    return {
        rulesVersion,
        seeds: [...seeds],
        floors: [...floors],
        bands: missRates.map((missRate) => summarizeBand(missRate, samples.filter((sample) => sample.missRate === missRate))),
        samples
    };
};

/**
 * The shape that has to hold. Numbers, not adjectives: a chunk player clears faster, the chunk is
 * a real part of the score without becoming most of it, Fever is a thing a clean player reaches on
 * the floors big enough to hold ten pairs, and nobody's rating ever moved because of a chunk.
 */
export const CASCADE_BALANCE_BANDS = {
    /** Every band, every floor: a floor ends cleared or in a death, never stuck. */
    minSettledShare: 1,
    /** A player who never misses clears every floor. */
    cleanClearedShare: { min: 1 },
    /** At zero misses, chunk score over level score on floors with a chunk: real, not dominant. */
    cleanChunkShareOfScore: { min: 0.08, max: 0.4 },
    /** Turns to clear at zero misses over turns at the reference miss rate: faster, and by enough to feel. */
    cleanTurnsOverReferenceTurns: { max: 0.9 },
    /** Fever floor share at zero misses, over floors with at least eight pairs. */
    cleanFeverShareOnBigFloors: { min: 0.5 },
    bigFloorPairs: 8,
    /** Fever floor share at the reference miss rate: rare, or the ladder is not a ladder. */
    referenceFeverShare: { max: 0.2 },
    referenceMissRate: 0.25
} as const;

export const assertCascadeBalanceWithinBands = (
    report: CascadeBalanceReport,
    bands: typeof CASCADE_BALANCE_BANDS = CASCADE_BALANCE_BANDS
): { ok: boolean; issues: string[] } => {
    const issues: string[] = [];
    const clean = report.bands.find((band) => band.missRate === 0);
    const reference = report.bands.find((band) => band.missRate === bands.referenceMissRate);
    for (const band of report.bands) {
        if (band.settledShare < bands.minSettledShare) {
            issues.push(`missRate ${band.missRate}: settledShare ${band.settledShare.toFixed(3)} below ${bands.minSettledShare} (a floor got stuck)`);
        }
        if (band.ratingDriftFloors > 0) {
            issues.push(`missRate ${band.missRate}: rating drifted from mistakes on ${band.ratingDriftFloors} floor(s)`);
        }
    }
    if (clean) {
        if (clean.clearedShare < bands.cleanClearedShare.min) {
            issues.push(`clean clearedShare ${clean.clearedShare.toFixed(3)} below ${bands.cleanClearedShare.min}`);
        }
        if (clean.chunkShareOfScore < bands.cleanChunkShareOfScore.min || clean.chunkShareOfScore > bands.cleanChunkShareOfScore.max) {
            issues.push(`clean chunkShareOfScore ${clean.chunkShareOfScore.toFixed(3)} outside ${bands.cleanChunkShareOfScore.min}-${bands.cleanChunkShareOfScore.max}`);
        }
        const bigFloors = report.samples.filter((sample) => sample.missRate === 0 && sample.pairsOnFloor >= bands.bigFloorPairs);
        const feverOnBig = bigFloors.length === 0 ? 0 : bigFloors.filter((sample) => sample.feverBreaks > 0).length / bigFloors.length;
        if (bigFloors.length > 0 && feverOnBig < bands.cleanFeverShareOnBigFloors.min) {
            issues.push(`clean Fever share on big floors ${feverOnBig.toFixed(3)} below ${bands.cleanFeverShareOnBigFloors.min}`);
        }
    }
    if (clean && reference && reference.meanTurns > 0) {
        const ratio = clean.meanTurns / reference.meanTurns;
        if (ratio > bands.cleanTurnsOverReferenceTurns.max) {
            issues.push(`clean/reference turns ratio ${ratio.toFixed(3)} above ${bands.cleanTurnsOverReferenceTurns.max}`);
        }
    }
    if (reference && reference.feverFloorShare > bands.referenceFeverShare.max) {
        issues.push(`reference feverFloorShare ${reference.feverFloorShare.toFixed(3)} above ${bands.referenceFeverShare.max}`);
    }
    return { ok: issues.length === 0, issues };
};

export const summarizeCascadeBalance = (report: CascadeBalanceReport): string =>
    report.bands
        .map(
            (band) =>
                `miss=${band.missRate}: cleared=${band.clearedShare.toFixed(2)} settled=${band.settledShare.toFixed(2)} turns=${band.meanTurns.toFixed(1)} ` +
                `mistakes=${band.meanMistakes.toFixed(2)} score=${band.meanLevelScore.toFixed(0)} chunkShare=${band.chunkShareOfScore.toFixed(2)} ` +
                `breaks/floor=${band.chunkBreaksPerFloor.toFixed(2)} pairs/floor=${band.chunkPairsPerFloor.toFixed(2)} ` +
                `fever=${band.feverFloorShare.toFixed(2)} drift=${band.ratingDriftFloors}`
        )
        .join('\n');
