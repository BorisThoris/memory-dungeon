import { buildBoard } from './board-build-rules';
import { chainTierRungs, type ChainTier } from './chain-tier-rules';
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
    suits: number;
    /** Matches tried on this floor, and how many of them popped at least one other pair. */
    matches: number;
    popped: number;
    /** Pairs those matches took with them, summed. */
    poppedPairs: number;
    /** The same matches replayed at each tier's own rung: pairs taken, summed, per tier. */
    tierPairs: Readonly<Record<ChainTier, number>>;
}

/**
 * The chain ladder, measured as what each rung actually takes off the board.
 *
 * `pairsPerMatch` above is the chain-one number - whether the loop is reachable. This is whether
 * climbing is worth anything, which is a different question and was answered no: on the boards
 * this file builds, Sharp used to pay three hundredths of a pair more than Clean. A rung nobody
 * can feel is a rung that is not there, so the ladder is measured and banded like everything else.
 */
export interface PopReachLadderReport {
    /** Mean pairs a match takes at this tier's own rung, over every floor measured. */
    pairsPerMatch: Readonly<Record<ChainTier, number>>;
    /** The gain from the rung below; `none` is its own value. */
    step: Readonly<Record<ChainTier, number>>;
    /** Fever's take minus a lone match's. */
    spread: number;
}

export interface PopReachLevelReport {
    level: number;
    floors: number;
    meanWholePairs: number;
    /** Pairs a break could actually take: what the suit palette is sized against. */
    meanSuits: number;
    /** Share of matches on this floor that pop at least one other pair, at chain one. */
    popRate: number;
    /** Mean pairs a match takes with it, at chain one. */
    pairsPerMatch: number;
}

export interface PopReachReport {
    levels: PopReachLevelReport[];
    samples: PopReachFloorSample[];
    ladder: PopReachLadderReport;
}

export const POP_REACH_TIERS: readonly ChainTier[] = ['none', 'clean', 'sharp', 'fever'];

export const POP_REACH_SEEDS = [11, 202, 3003, 40404, 555, 6006, 77, 8888] as const;

export const simulatePopReach = (levels = 12, seeds: readonly number[] = POP_REACH_SEEDS): PopReachReport => {
    const samples: PopReachFloorSample[] = [];
    const run = { gameMode: 'endless' as const, floorCurioId: null };
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
            // Each tier is replayed at its own rung on this floor, because the rungs are a share of
            // the floor's pairs: a fixed chain of 30 is already Fever on a small board, which is how
            // the flat middle of the ladder stayed hidden.
            const rungs = chainTierRungs(board.pairCount);
            const chainForTier: Record<ChainTier, number> = { none: 1, clean: rungs.clean, sharp: rungs.sharp, fever: rungs.fever };
            const tierPairs: Record<ChainTier, number> = { none: 0, clean: 0, sharp: 0, fever: 0 };
            for (const halves of whole) {
                if (halves.some((half) => half.state !== 'hidden')) continue;
                matches += 1;
                const matchedTileIds = halves.map((half) => half.id);
                const broke = resolveChunkBreak({ board, run, matchedTileIds, chain: 1 });
                if (broke.brokenPairKeys.length > 0) popped += 1;
                poppedPairs += broke.brokenPairKeys.length;
                for (const tier of POP_REACH_TIERS) {
                    const atTier =
                        tier === 'none'
                            ? broke
                            : resolveChunkBreak({ board, run, matchedTileIds, chain: chainForTier[tier] });
                    tierPairs[tier] += atTier.brokenPairKeys.length;
                }
            }
            samples.push({
                level,
                seed,
                wholePairs: whole.length,
                suits: new Set(board.tiles.map((tile) => tile.suit ?? 'none')).size,
                matches,
                popped,
                poppedPairs,
                tierPairs
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
    const allMatches = samples.reduce((sum, sample) => sum + sample.matches, 0);
    const pairsPerMatch = {} as Record<ChainTier, number>;
    for (const tier of POP_REACH_TIERS) {
        pairsPerMatch[tier] =
            allMatches === 0 ? 0 : samples.reduce((sum, sample) => sum + sample.tierPairs[tier], 0) / allMatches;
    }
    const step = {} as Record<ChainTier, number>;
    POP_REACH_TIERS.forEach((tier, index) => {
        const below = index === 0 ? 0 : pairsPerMatch[POP_REACH_TIERS[index - 1]!];
        step[tier] = pairsPerMatch[tier] - below;
    });
    return {
        levels: levelsOut,
        samples,
        ladder: { pairsPerMatch, step, spread: pairsPerMatch.fever - pairsPerMatch.none }
    };
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
    perLevelPopRate: { min: 0.25 },
    /**
     * The ladder. Every rung has to be worth climbing, and the whole climb has to be worth
     * something - the two ways a chain ladder fails, and the game had shipped both. `minStep` is
     * set below the thinnest rung the shipped ladder has rather than at a round number: it is a
     * ratchet against the 0.01 that rung used to pay, not a target to tune toward. Sharp paid 0.39
     * over Clean on the linear curve and 0.30 on the tempered one (Gen 179): the early floors are
     * bigger but still one or two suits, so Clean's two waves sweep most of what Sharp's reaction
     * could reach. The severance drop (thesis §37.3) is the rung that gives Sharp something back.
     */
    ladderMinStep: { min: 0.25 },
    /** Fever over a lone match. Was 1.66 before the reach ladder and the bigger suits. */
    ladderSpread: { min: 2.2 }
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
    for (const tier of POP_REACH_TIERS) {
        const step = report.ladder.step[tier];
        if (step < POP_REACH_BANDS.ladderMinStep.min) {
            issues.push(
                `chain tier ${tier} takes ${step.toFixed(3)} pairs more than the rung below, under ${POP_REACH_BANDS.ladderMinStep.min}`
            );
        }
    }
    if (report.ladder.spread < POP_REACH_BANDS.ladderSpread.min) {
        issues.push(`ladder spread none to fever ${report.ladder.spread.toFixed(3)} below ${POP_REACH_BANDS.ladderSpread.min}`);
    }
    return { ok: issues.length === 0, issues };
};

export const summarizePopReach = (report: PopReachReport): string =>
    report.levels
        .map(
            (level) =>
                `floor ${String(level.level).padStart(2)}: pairs=${level.meanWholePairs.toFixed(1)} ` +
                `suits=${level.meanSuits.toFixed(1)} ` +
                `popRate=${level.popRate.toFixed(2)} pairsPerMatch=${level.pairsPerMatch.toFixed(2)}`
        )
        .concat([
            `ladder pairsPerMatch: ${POP_REACH_TIERS.map(
                (tier) => `${tier}=${report.ladder.pairsPerMatch[tier].toFixed(2)} (+${report.ladder.step[tier].toFixed(2)})`
            ).join('  ')}`,
            `ladder spread none to fever: ${report.ladder.spread.toFixed(2)}`
        ])
        .join('\n');
