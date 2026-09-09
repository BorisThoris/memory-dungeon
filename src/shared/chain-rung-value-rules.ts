import { CHAIN_MULT } from './chunk-break-rules';
import type { ChainTier } from './chain-tier-rules';

/**
 * What a rung is worth.
 *
 * The chain meter said where the player stood on the ladder and never what standing there was
 * worth, so a new player had no way to discover that holding a pair is a strategy except by
 * accident (thesis §30.2, §30.3a).
 *
 * Gen 186 answered it in pairs and Gen 189 corrected that. Pairs are the ladder's *input*: measured
 * by `simulatePopReach` the rungs take 1.91 / 3.19 / 3.50 / 6.95 pairs, which reads as a ladder with
 * a dead middle - Sharp finding a third of a pair more than Clean. But the tier multiplies what it
 * finds, so the same rungs pay 70 / 226 / 506 / 2036 score: **x3.2, x2.2, x4.0**. Every rung more
 * than doubles the payoff. The ladder was never thin; the measurement was, and the interface
 * inherited it. What the meter shows is the multiplier, because that is what the player is paid.
 */
export const CHAIN_RUNG_SCORE_MULTIPLIER: Readonly<Record<ChainTier, number>> = CHAIN_MULT;

/**
 * The pairs a break takes at each rung, measured by `simulatePopReach` over eight seeds and twelve
 * levels and rounded. Kept because the sentence a player reads on hover is more useful with both -
 * what a rung finds and what it pays - but the number on screen is the multiplier.
 *
 * Measured at Gen 197, once the pop stopped reaching cards it was not touching: none 1.46, clean
 * 2.10, sharp 5.79, fever 8.46. (Gen 193, with the partner reach and the halo still in: 1.47, 2.61,
 * 3.04, 7.55. Gen 186, before any of it: 1.91, 3.19, 3.50, 6.95.)
 *
 * Clean and Sharp used to both round to three - the dead middle Gen 189 answered by showing the
 * multiplier instead of the pairs. They no longer do. Sharp is where the bridge starts, so it is
 * the rung where a break stops being one clump and becomes two, and the pairs now say so on their
 * own. The meter still shows the multiplier, because that is still what the player is paid.
 */
export const CHAIN_RUNG_PAIRS: Readonly<Record<ChainTier, number>> = {
    none: 1,
    clean: 2,
    sharp: 6,
    fever: 8
};

/**
 * How far the constant above may sit from a fresh measurement before it is lying. Half a pair plus
 * a tenth: wide enough that the rounding boundary at Sharp (3.50) does not trip on noise, tight
 * enough that a rung which quietly halves is caught.
 */
export const CHAIN_RUNG_PAIRS_TOLERANCE = 0.6;

/** What a break at this rung multiplies its score by: the ladder as the player is paid it. */
export const chainRungScoreMultiplier = (tier: ChainTier): number => CHAIN_RUNG_SCORE_MULTIPLIER[tier];

/** The pairs a break at this rung takes, for the sentence that explains the multiplier. */
export const chainRungPairs = (tier: ChainTier): number => CHAIN_RUNG_PAIRS[tier];
