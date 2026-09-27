import { chainRungScoreMultiplier } from './chain-rung-value-rules';
import { CHAIN_TIER_CLEAN_FROM, getChainTier, type ChainTier } from './chain-tier-rules';
import { BREAK_PAIR_CAP } from './chunk-break-rules';
import { runNonNegativeInteger } from './run-number-guards';

export type ChainTargetBand = 'seed' | 'reward' | 'combo' | 'mastery';

export interface ChainTargetFeedback {
    band: ChainTargetBand;
    bestStreak: number;
    value: string;
    detail: string;
    actionHint: string;
    payoffLabel: string;
    payoffValue: string;
}

/**
 * The next rung to chase, in the ladder's own words.
 *
 * Shown at the moment the player decides whether to go again (the run summary), after a miss
 * that dropped a chain (the board's recovery line) and as the aim guide's plan. It used to speak
 * a chain economy the game no longer has - "x3 reward loop", "combo engine", "x10 pressure" -
 * while the HUD spoke of Clean, Sharp and Fever. The bands are the ladder's default rungs
 * (`chainTierRungs` with no floor), and the pay each rung names is the multiplier the HUD shows.
 */
/*
 * `reached` is authoritative when present. Small boards and cascade momentum can earn a tier
 * with fewer matches; large boards can require more matches than the legacy fixed thresholds.
 * Infer from streak only for older summaries that did not record the tier.
 */
/*
 * The chain as a count of matches, never as "×N": the ladder beside it prints its multipliers as "×2",
 * "×4", "×8", and "Best chain ×4, at Fever" read as the Sharp multiplier on a Fever run (Gen 263).
 */
const chainLinks = (bestStreak: number): string =>
    `Best chain: ${bestStreak} ${bestStreak === 1 ? 'match' : 'matches'} in a row`;

export const getChainTargetFeedback = (
    bestStreakInput: number | null | undefined,
    reached?: ChainTier | null
): ChainTargetFeedback => {
    const bestStreak = runNonNegativeInteger(bestStreakInput);
    const sharpPays = chainRungScoreMultiplier('sharp');
    const feverPays = chainRungScoreMultiplier('fever');
    const tier = reached ?? getChainTier(bestStreak);
    if (tier === 'fever') {
        return {
            band: 'mastery',
            bestStreak,
            value: 'Hold Fever',
            detail: `${chainLinks(bestStreak)}, and the ladder reached Fever. The record now is how long you keep it.`,
            actionHint: 'Bank the pairs you are sure of first, then spend tools to protect the chain.',
            payoffLabel: 'Chain mastery',
            payoffValue: 'hold Fever'
        };
    }
    if (tier === 'sharp') {
        return {
            band: 'combo',
            bestStreak,
            value: 'Reach Fever',
            detail: `${chainLinks(bestStreak)}. Fever can pop up to ${BREAK_PAIR_CAP.fever} extra pairs and bridge into a neighbouring suit. Popped pairs score ×${feverPays} before ripple bonuses.`,
            actionHint: 'Hold the chain through the clumps you know; peek before you guess.',
            payoffLabel: 'Chain chase',
            payoffValue: 'Fever next'
        };
    }
    if (tier === 'clean') {
        return {
            band: 'reward',
            bestStreak,
            value: 'Reach Sharp',
            detail: `${chainLinks(bestStreak)}. Sharp can pop up to ${BREAK_PAIR_CAP.sharp} extra pairs and ripple through the same suit. Popped pairs score ×${sharpPays} before ripple bonuses.`,
            actionHint: 'Build momentum with pairs you remember, then match beside a same-suit clump.',
            payoffLabel: 'Chain chase',
            payoffValue: 'Sharp next'
        };
    }
    return {
        band: 'seed',
        bestStreak,
        value: 'Reach Clean',
        detail:
            bestStreak > 0
                ? `${chainLinks(bestStreak)}. ${CHAIN_TIER_CLEAN_FROM} momentum reaches Clean, where a match can pop a nearby pair of the same suit.`
                : `No chain yet. ${CHAIN_TIER_CLEAN_FROM} momentum reaches Clean, where a match can pop a nearby pair of the same suit.`,
        actionHint: 'Memorize one clump first, then clear those pairs before exploring.',
        payoffLabel: 'Chain chase',
        payoffValue: 'Clean next'
    };
};
