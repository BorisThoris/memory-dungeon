import { chainRungScoreMultiplier } from '../../shared/chain-rung-value-rules';
import type { ChainTier } from '../../shared/chain-tier-rules';

export type ChainMilestoneFeedback = {
    action: 'Hold the chain' | 'Carry it into the next clump' | 'Keep the fire';
    audioCue: 'chain-start-ping' | 'surge-hit-ping' | 'combo-hit-ping';
    beatCount: 3 | 4 | 5;
    label: 'Clean reached' | 'Sharp reached' | 'Fever reached';
    screenCue: 'reward-loop' | 'surge-live' | 'combo-live';
    /** What the rung pays per pair a break takes, as the chain rail prints it (`×2`). */
    target: string;
    tone: 'chain' | 'surge' | 'combo';
    value: string;
};

const TIER_ORDER: readonly ChainTier[] = ['none', 'clean', 'sharp', 'fever'];

const MILESTONES: Record<Exclude<ChainTier, 'none'>, Omit<ChainMilestoneFeedback, 'target' | 'value'>> = {
    clean: { action: 'Hold the chain', audioCue: 'chain-start-ping', beatCount: 3, label: 'Clean reached', screenCue: 'reward-loop', tone: 'chain' },
    sharp: { action: 'Carry it into the next clump', audioCue: 'surge-hit-ping', beatCount: 4, label: 'Sharp reached', screenCue: 'surge-live', tone: 'surge' },
    fever: { action: 'Keep the fire', audioCue: 'combo-hit-ping', beatCount: 5, label: 'Fever reached', screenCue: 'combo-live', tone: 'combo' }
};

/**
 * The rung a turn climbed to, called out once - read from the rung the chain rail shows.
 *
 * This used to count the raw streak against fixed marks (3, 6, 10) and print the mark as the
 * multiplier: "Clean reached: x3" under a rail reading "Clean ×2", and "Sharp reached: x6" on a
 * floor whose rail had gone Fever at chain 5 - the rungs scale with the floor and count the pop's
 * momentum, the marks did neither. Seen on a deep playtest, floor 10. The rung now comes from
 * `chainTierBefore/After` (`runChainTier`) and the number from the rung's own multiplier.
 */
export const getChainMilestoneFeedback = (
    tierBefore: ChainTier | null | undefined,
    tierAfter: ChainTier | null | undefined
): ChainMilestoneFeedback | undefined => {
    const before = TIER_ORDER.indexOf(tierBefore ?? 'none');
    const after = TIER_ORDER.indexOf(tierAfter ?? 'none');
    if (after <= Math.max(0, before)) {
        return undefined;
    }
    const tier = TIER_ORDER[after] as Exclude<ChainTier, 'none'>;
    const multiplier = chainRungScoreMultiplier(tier);
    return {
        ...MILESTONES[tier],
        target: `×${multiplier}`,
        value: `Every pair a break takes pays ×${multiplier}`
    };
};
