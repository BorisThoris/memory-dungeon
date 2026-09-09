import type { ChainTier } from './chain-tier-rules';

/**
 * What a rung is worth, in pairs.
 *
 * The chain meter said where the player stood on the ladder and never what standing there was
 * worth, so a new player had no way to discover that holding a pair is a strategy except by
 * accident (thesis §30.2, §30.3a). These are the pairs a break takes at each tier's own rung,
 * measured by `simulatePopReach` over eight seeds and twelve levels - the same run `yarn sim:pop`
 * makes - and rounded to something a small cluster of pips can carry.
 *
 * Measured at Gen 186: none 1.91, clean 3.19, sharp 3.50, fever 6.95. `chain-rung-value-rules.test`
 * re-measures and fails if the ladder walks away from these, because a meter that promises three
 * pairs while the rule pays one is worse than a meter that promises nothing.
 */
export const CHAIN_RUNG_PAIRS: Readonly<Record<ChainTier, number>> = {
    none: 2,
    clean: 3,
    sharp: 4,
    fever: 7
};

/**
 * How far the constant above may sit from a fresh measurement before it is lying. Half a pair plus
 * a tenth: wide enough that the rounding boundary at Sharp (3.50) does not trip on noise, tight
 * enough that a rung which quietly halves is caught.
 */
export const CHAIN_RUNG_PAIRS_TOLERANCE = 0.6;

/** The pips a rung draws: one per pair it takes, so the cluster grows as the player climbs. */
export const chainRungPips = (tier: ChainTier): number => CHAIN_RUNG_PAIRS[tier];
