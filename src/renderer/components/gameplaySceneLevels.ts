import type { ChainTier } from '../../shared/chain-tier-rules';

/**
 * Ring intensities per chain tier for `GameplayScene`: [floor light pass, glow layer]. Each tier
 * lifts both; `fever` additionally rotates the glow toward rose in the stylesheet.
 */
export const SCENE_RING_LEVELS: Readonly<Record<ChainTier, readonly [number, number]>> = {
    none: [0.55, 0.72],
    clean: [0.78, 0.92],
    sharp: [1.0, 1.1],
    fever: [1.25, 1.35]
};
