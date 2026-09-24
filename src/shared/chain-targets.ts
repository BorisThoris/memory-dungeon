import { chainRungScoreMultiplier } from './chain-rung-value-rules';
import { CHAIN_TIER_CLEAN_FROM, getChainTier, higherChainTier, type ChainTier } from './chain-tier-rules';
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
 * `reached` is the rung the run's ladder actually showed. Without it the band is read off the
 * streak against the fixed rungs, and the ladder does not climb on the streak alone: a run whose
 * HUD had said Sharp, and whose floor clears had paid Sharp, was told at the end to "Reach Clean".
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
    const tier = higherChainTier(reached, getChainTier(bestStreak));
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
            detail: `${chainLinks(bestStreak)}. Fever chains into three clumps and pays ×${feverPays} a pair.`,
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
            detail: `${chainLinks(bestStreak)}. Sharp chains into the next clump and pays ×${sharpPays} a pair.`,
            actionHint: 'Open with pairs you are sure of, then carry the chain into the next clump.',
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
                ? `${chainLinks(bestStreak)}. ${CHAIN_TIER_CLEAN_FROM} matches in a row reach Clean, where a break reaches deeper into the clump.`
                : `No chain yet. ${CHAIN_TIER_CLEAN_FROM} matches in a row reach Clean, where a break reaches deeper into the clump.`,
        actionHint: 'Memorize one clump first, then clear those pairs before exploring.',
        payoffLabel: 'Chain chase',
        payoffValue: 'Clean next'
    };
};
