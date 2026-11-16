import { plural, tr } from './i18n';
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
    tr`Best chain: ${plural(bestStreak, { one: '{0} match', other: '{0} matches' })} in a row`;

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
            value: tr.s('Hold Fever'),
            detail: tr`${chainLinks(bestStreak)}, and the ladder reached Fever. The record now is how long you keep it.`,
            actionHint: tr.s('Bank the pairs you are sure of first, then spend tools to protect the chain.'),
            payoffLabel: tr.s('Chain mastery'),
            payoffValue: tr.s('hold Fever')
        };
    }
    if (tier === 'sharp') {
        return {
            band: 'combo',
            bestStreak,
            value: tr.s('Reach Fever'),
            detail: `${chainLinks(bestStreak)}. Fever can pop up to ${BREAK_PAIR_CAP.fever} extra pairs and bridge into a neighbouring suit. Popped pairs score ×${feverPays} before ripple bonuses.`,
            actionHint: tr.s('Hold the chain through the clumps you know; peek before you guess.'),
            payoffLabel: tr.s('Chain chase'),
            payoffValue: tr.s('Fever next')
        };
    }
    if (tier === 'clean') {
        return {
            band: 'reward',
            bestStreak,
            value: tr.s('Reach Sharp'),
            detail: `${chainLinks(bestStreak)}. Sharp can pop up to ${BREAK_PAIR_CAP.sharp} extra pairs and ripple through the same suit. Popped pairs score ×${sharpPays} before ripple bonuses.`,
            actionHint: tr.s('Build momentum with pairs you remember, then match beside a same-suit clump.'),
            payoffLabel: tr.s('Chain chase'),
            payoffValue: tr.s('Sharp next')
        };
    }
    return {
        band: 'seed',
        bestStreak,
        value: tr.s('Reach Clean'),
        detail:
            bestStreak > 0
                ? `${chainLinks(bestStreak)}. ${CHAIN_TIER_CLEAN_FROM} momentum reaches Clean, where a match can pop a nearby pair of the same suit.`
                : tr`No chain yet. ${CHAIN_TIER_CLEAN_FROM} momentum reaches Clean, where a match can pop a nearby pair of the same suit.`,
        actionHint: tr.s('Memorize one clump first, then clear those pairs before exploring.'),
        payoffLabel: tr.s('Chain chase'),
        payoffValue: tr.s('Clean next')
    };
};
