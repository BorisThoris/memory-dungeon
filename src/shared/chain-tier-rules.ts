/**
 * The chain ladder.
 *
 * The streak — consecutive correct matches — already existed as a score multiplier and a number
 * in the HUD. Peggle's multiplier is not a number; it is a ladder you can feel yourself climbing,
 * and every rung changes what the board does. So the streak gets tiers with names, and the tiers
 * unlock the chunk break (`chunk-break-rules.ts`): a lone match is a match, a Clean chain breaks
 * the tiles beside the match, a Sharp chain breaks the whole region, and Fever is the celebration.
 *
 * A mismatch drops the chain to zero, the way a missed peg ends the shot. That is the "one more"
 * tension the whole genre runs on, and here it maps onto a real skill: the chain is literally how
 * many things in a row you remembered.
 *
 * See `docs/CHAIN_CHUNK_FEVER_DESIGN.md` §2.2.
 */
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

export const getChainTier = (chain: number): ChainTier => {
    const depth = Number.isFinite(chain) ? Math.max(0, Math.floor(chain)) : 0;
    if (depth >= CHAIN_TIER_FEVER_FROM) return 'fever';
    if (depth >= CHAIN_TIER_SHARP_FROM) return 'sharp';
    if (depth >= CHAIN_TIER_CLEAN_FROM) return 'clean';
    return 'none';
};

/** Whether a chain at this depth is allowed to break a chunk at all. */
export const chainCanBreakChunk = (chain: number): boolean => getChainTier(chain) !== 'none';

/** The next rung, for "one more and the region goes" copy; null at the top. */
export const nextChainTierAt = (chain: number): number | null => {
    const tier = getChainTier(chain);
    if (tier === 'none') return CHAIN_TIER_CLEAN_FROM;
    if (tier === 'clean') return CHAIN_TIER_SHARP_FROM;
    if (tier === 'sharp') return CHAIN_TIER_FEVER_FROM;
    return null;
};
