import type { ChainTier } from '../../shared/chain-tier-rules';

/**
 * What the chain and the chunk say.
 *
 * A chunk break that is not named is indistinguishable from a bug: pairs the player never
 * touched vanish, and the only story available to them is that the board glitched. The line is
 * the difference between "the game ate my pairs" and "my chain took the whole Ember clump".
 */
export const CHAIN_TIER_LABELS: Readonly<Record<ChainTier, string>> = {
    none: '',
    clean: 'Clean',
    sharp: 'Sharp',
    fever: 'Fever'
};

/** Grid steps between a broken pair's halves that earn "Partner across the board". */
export const CHAIN_STYLE_LONG_SPAN = 4;

export const CHAIN_BEAT_COPY = {
    /**
     * The break's line: the one the feedback rail shows and a screen reader speaks, so it has to
     * carry size and cause in one sentence. A break with no chain behind it is the pop.
     */
    chunkAnnouncement: (pairs: number, tier: ChainTier, chain: number): string =>
        tier === 'none'
            ? `Pop. ${pairs} ${pairs === 1 ? 'pair' : 'pairs'} of the same suit touching that match broke away and left the board.`
            : `Chain ${chain}, ${CHAIN_TIER_LABELS[tier]} break. ${pairs} more ${
                  pairs === 1 ? 'pair' : 'pairs'
              } of the same suit broke away with that match and left the board.`,
    /** The clump read on a focused tile: what it stands in, and what a match there pops. */
    clumpRead: (suitName: string, size: number, pairsSharpWouldTake: number): string =>
        `${suitName} clump of ${size}` +
        (pairsSharpWouldTake > 0
            ? ` — a match here pops ${pairsSharpWouldTake} more ${pairsSharpWouldTake === 1 ? 'pair' : 'pairs'}.`
            : '.'),
    /**
     * The style line: what made this break worth a name. Peggle labels the shot ("Long shot",
     * "Lucky bounce") so the player can own it; one line, only the tags that apply, or nothing.
     */
    styleLine: (style: {
        chunkPartnerSpanMax: number;
        chunkHaloPairs: number;
        chunkTreasuresSpilled: number;
        chunkSuitCleared: boolean;
        chunkDroppedPairs?: number;
        chunkRippleWaves?: number;
    }): string | null => {
        const tags: string[] = [];
        // The ripple reads first: a reaction that ran on after the pop is the shot to own.
        const waves = style.chunkRippleWaves ?? 0;
        if (waves >= 2) tags.push(`Ripple ×${waves}`);
        // Then the drop: a pair that fell with nothing touching it is the surprise.
        const dropped = style.chunkDroppedPairs ?? 0;
        if (dropped > 0) tags.push(dropped === 1 ? 'Drop' : `Drop ×${dropped}`);
        if (style.chunkPartnerSpanMax >= CHAIN_STYLE_LONG_SPAN) tags.push('Partner across the board');
        if (style.chunkHaloPairs > 0) tags.push('Halo');
        if (style.chunkTreasuresSpilled > 0) {
            tags.push(style.chunkTreasuresSpilled === 1 ? 'Treasure spill' : `Treasure spill ×${style.chunkTreasuresSpilled}`);
        }
        if (style.chunkSuitCleared) tags.push('Clean sweep');
        return tags.length === 0 ? null : `${tags.join(', ')}.`;
    },
    /** Hover on the chain stat: what the tier is made of and where the next rungs sit on this floor. */
    momentumHint: (chain: number, cascaded: number, rungs: { sharp: number; fever: number }): string =>
        `${cascaded > 0 ? `Chain ${chain} plus ${cascaded} cascaded, momentum ${chain + cascaded}` : `Chain ${chain}`}. ` +
        `Every match pops the clump it touches. Clean from 3 lets the partners ripple, Sharp from ${rungs.sharp} runs the reaction out, Fever from ${rungs.fever} adds the halo on this floor. A miss halves the chain and puts the fire out.`,
    /** The meter, for a screen reader: where the momentum stands on the ladder. */
    meterLabel: (momentum: number, feverAt: number, full: boolean): string =>
        full ? `Fever meter full: momentum ${momentum}.` : `Fever meter: momentum ${momentum} of ${feverAt}.`,
    codexChainTitle: 'Chain, chunk and Fever',
    codexChainDescription:
        'Every match pops: the whole same-suit clump touching the two tiles you matched breaks away with them, and the partners of those pairs go too, wherever they sit. ' +
        'The chain decides how far the pops ripple. With no chain the partners leave and stop. From chain 3 (Clean) each partner that left takes its own clump - a second wave. ' +
        'Sharp - about two-fifths of the floor\'s pairs of momentum, four at least - runs the reaction until a wave takes nothing. Fever - about two-thirds, seven at least - adds the halo: everything touching the first clump, whatever its suit. ' +
        'Every pair a break takes adds to the chain\'s momentum. Treasure inside a break spills and pays as if you had matched it. Broken pairs score less than matched ones and give no recall credit - memory still pays best - but they drop combo shards, ' +
        'clear the floor faster, and a longer ripple pays more. A miss halves the chain and puts the fire out. ' +
        'A break with a shape gets a name on the run line: a ripple that ran on, a drop, a partner taken from across the board, a halo, a treasure spill, a clean sweep of a suit. ' +
        'Clear the floor with momentum still standing and the end pays out: a gold at Clean and Sharp, a shard and two gold at Fever - Extreme Fever. Never score, never rating.'
} as const;
