import { CHAIN_MULT, chunkBreakScore, chunkScorePerPair, waveMult } from './chunk-break-rules';
import type { ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The break's score, as the terms it is made of.
 *
 * Thesis §40.4: the multiplier is shown *as it is applied* - `4 pairs × Clean ×2 × Ripple ×1.75` -
 * built up term by term as the break resolves, so the player watches the number being constructed.
 * That is the single most satisfying moment in Balatro and it is nearly free here, because Gen 181
 * already made the score multiplicative: the terms exist, they were simply multiplied out of sight.
 *
 * Derived from the same functions `chunkBreakScore` multiplies, so the terms cannot drift from the
 * score they explain, and the last running total is the awarded score exactly rather than a
 * rounding of it.
 */
export interface ScoreTerm {
    id: 'pairs' | 'tier' | 'ripple';
    /** The multiplier this term applies; for `pairs` it is the pair count itself. */
    factor: number;
    /** The tier this term names, for the `tier` term only - the copy layer turns it into a word. */
    tier?: ChainTier;
    /** The waves the ripple ran, for the `ripple` term only. */
    waves?: number;
    /** The score once this term has been applied: what the floater's total reads after this beat. */
    runningTotal: number;
}

export interface BreakScoreBreakdown {
    /** What one broken pair is worth on this floor, before any multiplier. */
    perPair: number;
    terms: ScoreTerm[];
    /** The break's score, identical to `chunkBreakScore` for the same turn. */
    total: number;
}

/**
 * The terms of a break, or null when the turn broke nothing - a plain match has no break score to
 * construct, and a floater that showed `1 pair × 1` would be teaching the ladder backwards.
 */
export const getBreakScoreBreakdown = ({
    level,
    pairs,
    tier,
    waves
}: {
    level: number;
    pairs: number;
    tier: ChainTier;
    waves: number;
}): BreakScoreBreakdown | null => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) {
        return null;
    }
    const perPair = chunkScorePerPair(level);
    const total = chunkBreakScore(level, count, tier, waves);
    const terms: ScoreTerm[] = [{ id: 'pairs', factor: count, runningTotal: Math.floor(perPair * count) }];

    const tierMult = CHAIN_MULT[tier];
    if (tierMult > 1) {
        terms.push({ id: 'tier', factor: tierMult, tier, runningTotal: Math.floor(perPair * count * tierMult) });
    }
    const ripple = waveMult(waves);
    if (ripple > 1) {
        terms.push({ id: 'ripple', factor: ripple, waves: runNonNegativeInteger(waves), runningTotal: total });
    }

    // The last beat always lands on the awarded score: the intermediate totals may round, the end
    // may not, or the player watches a number climb to something the run never gave them.
    const last = terms[terms.length - 1];
    if (last) {
        last.runningTotal = total;
    }
    return { perPair, terms, total };
};
