/**
 * The chain ladder.
 *
 * The streak — consecutive correct matches — already existed as a score multiplier and a number
 * in the HUD. Peggle's multiplier is not a number; it is a ladder you can feel yourself climbing,
 * and every rung changes what the board does. So the streak gets tiers with names, and the tiers
 * unlock the chunk break (`chunk-break-rules.ts`): a lone match is a match, a Clean chain breaks
 * the tiles beside the match, a Sharp chain breaks the whole region, and Fever is the celebration.
 *
 * A mismatch halves the chain (`turn-mismatch-rules.ts`), the way a missed peg ends the shot.
 * That is the "one more" tension the whole genre runs on, and here it maps onto a real skill: the
 * chain is literally how many things in a row you remembered.
 *
 * The ladder climbs on momentum, not on the streak alone: the streak plus every pair the chunks
 * broke since the chain last dropped. Measured (`cascade-balance-simulation.ts`), a ladder that
 * counted only matches ate itself — the better the player, the more pairs the chunks took, the
 * fewer matches were left to climb with, and Fever arrived less often for a clean player than
 * for a sloppy one. In a bubble shooter the cascade counts toward the combo; here it counts
 * toward the tier and nothing else — the score streak, recall and rating never see it.
 *
 * See `docs/CHAIN_CHUNK_FEVER_DESIGN.md` §2.2.
 */
import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

export type ChainTier = 'none' | 'clean' | 'sharp' | 'fever';

/*
 * One ladder, not two. The game already announces chain milestones at x3 ("Chain started"), x6
 * ("Surge") and x10 ("Combo") — chain targets, milestone pings and the feedback rail all read
 * those rungs. The break tiers sit on the same rungs so a player climbing hears one story:
 * the ping at x3 is the moment the board starts breaking for you.
 */
export const CHAIN_TIER_CLEAN_FROM = 3;
export const CHAIN_TIER_SHARP_FROM = 6;
export const CHAIN_TIER_FEVER_FROM = 10;

/**
 * Sharp and Fever as shares of the floor's pairs, with the fixed rungs as floors.
 *
 * Measured, not guessed (`cascade-balance-simulation.ts`): with the rungs fixed at 6 and 10,
 * Fever arrived on zero percent of floors even for a player who never missed, because a Clean
 * break removes pairs and a ten-to-fourteen-pair floor ends before a chain of ten can exist. The
 * ladder was eating itself. A floor is the unit of this game, so the top rungs are a share of the
 * floor: Fever is "you ran most of this floor clean", which is what it always meant.
 */
export const CHAIN_TIER_SHARP_SHARE = 0.4;
export const CHAIN_TIER_FEVER_SHARE = 0.65;
export const CHAIN_TIER_SHARP_MIN = 4;
export const CHAIN_TIER_FEVER_MIN = 7;

export const chainTierRungs = (pairsOnFloor: number | null | undefined): { clean: number; sharp: number; fever: number } => {
    const pairs = Number.isFinite(pairsOnFloor) ? Math.max(0, Math.floor(pairsOnFloor as number)) : 0;
    if (pairs <= 0) {
        return { clean: CHAIN_TIER_CLEAN_FROM, sharp: CHAIN_TIER_SHARP_FROM, fever: CHAIN_TIER_FEVER_FROM };
    }
    const sharp = Math.max(CHAIN_TIER_SHARP_MIN, Math.ceil(pairs * CHAIN_TIER_SHARP_SHARE));
    const fever = Math.max(CHAIN_TIER_FEVER_MIN, sharp + 1, Math.ceil(pairs * CHAIN_TIER_FEVER_SHARE));
    return { clean: CHAIN_TIER_CLEAN_FROM, sharp, fever };
};

/** Momentum: the streak plus the pairs chunks broke since it last dropped. What the ladder reads. */
export const chainMomentum = (chain: number, cascadedPairs: number): number =>
    runNonNegativeInteger(chain) + runNonNegativeInteger(cascadedPairs);

/** The run's live tier: its momentum against its floor. The one call every surface should make. */
export const runChainTier = (run: Pick<RunState, 'stats' | 'chunkPairsThisChain' | 'board'>): ChainTier =>
    getChainTier(chainMomentum(run.stats.currentStreak, run.chunkPairsThisChain), run.board?.pairCount ?? null);

/** The tier a chain has reached on a floor of `pairsOnFloor` pairs; omit the floor for the fixed rungs. */
export const getChainTier = (chain: number, pairsOnFloor?: number | null): ChainTier => {
    const depth = Number.isFinite(chain) ? Math.max(0, Math.floor(chain)) : 0;
    const rungs = chainTierRungs(pairsOnFloor);
    if (depth >= rungs.fever) return 'fever';
    if (depth >= rungs.sharp) return 'sharp';
    if (depth >= rungs.clean) return 'clean';
    return 'none';
};

/** Whether a chain at this depth is allowed to break a chunk at all. */
export const chainCanBreakChunk = (chain: number, pairsOnFloor?: number | null): boolean =>
    getChainTier(chain, pairsOnFloor) !== 'none';

/**
 * The ladder as one bar: momentum over the Fever rung, with the Clean and Sharp rungs as ticks.
 *
 * Peggle's multiplier reads at a glance because it is a meter, not a number. One bar for the whole
 * ladder rather than one per rung: a bar that emptied the moment you reached Sharp would read as a
 * loss at the exact moment the player did something right.
 */
export interface ChainMeter {
    tier: ChainTier;
    /** 0..1 of the way to Fever; 1 at Fever and beyond. */
    fill: number;
    /** Where the Clean and Sharp rungs sit on the bar, 0..1. */
    ticks: { clean: number; sharp: number };
    /** True at Fever: the bar is full and stays full until the chain drops. */
    full: boolean;
    momentum: number;
    feverAt: number;
}

export const chainMeter = (momentum: number, pairsOnFloor?: number | null): ChainMeter => {
    const depth = runNonNegativeInteger(momentum);
    const rungs = chainTierRungs(pairsOnFloor);
    const fever = Math.max(1, rungs.fever);
    return {
        tier: getChainTier(depth, pairsOnFloor),
        fill: Math.min(1, depth / fever),
        ticks: { clean: Math.min(1, rungs.clean / fever), sharp: Math.min(1, rungs.sharp / fever) },
        full: depth >= fever,
        momentum: depth,
        feverAt: fever
    };
};

/** The run's own meter: its momentum against its floor. */
export const runChainMeter = (run: Pick<RunState, 'stats' | 'chunkPairsThisChain' | 'board'>): ChainMeter =>
    chainMeter(chainMomentum(run.stats.currentStreak, run.chunkPairsThisChain), run.board?.pairCount ?? null);

/** The next rung, for "one more and the region goes" copy; null at the top. */
export const nextChainTierAt = (chain: number, pairsOnFloor?: number | null): number | null => {
    const tier = getChainTier(chain, pairsOnFloor);
    const rungs = chainTierRungs(pairsOnFloor);
    if (tier === 'none') return rungs.clean;
    if (tier === 'clean') return rungs.sharp;
    if (tier === 'sharp') return rungs.fever;
    return null;
};
