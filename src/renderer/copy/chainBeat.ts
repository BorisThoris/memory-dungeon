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
    /** The run line, one sentence, has to carry size and cause. */
    chunkLine: (pairs: number, tier: ChainTier): string =>
        `${CHAIN_TIER_LABELS[tier] || 'Chain'} break: ${pairs} ${pairs === 1 ? 'pair' : 'pairs'} went with that match.`,
    /** Spoken to a screen reader, where the shatter wave is invisible. */
    chunkAnnouncement: (pairs: number, tier: ChainTier, chain: number): string =>
        `Chain ${chain}, ${CHAIN_TIER_LABELS[tier] || 'chain'} break. ${pairs} more ${
            pairs === 1 ? 'pair' : 'pairs'
        } of the same suit broke away with that match and left the board.`,
    feverLine: 'Fever. The whole clump went.',
    /**
     * The style line: what made this break worth a name. Peggle labels the shot ("Long shot",
     * "Lucky bounce") so the player can own it; one line, only the tags that apply, or nothing.
     */
    styleLine: (style: {
        chunkPartnerSpanMax: number;
        chunkHaloPairs: number;
        chunkTreasuresSpilled: number;
        chunkSuitCleared: boolean;
    }): string | null => {
        const tags: string[] = [];
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
        `Clean from 3, Sharp from ${rungs.sharp}, Fever from ${rungs.fever} on this floor. A miss halves the chain and puts the fire out.`,
    codexChainTitle: 'Chain, chunk and Fever',
    codexChainDescription:
        'Every correct match in a row raises your chain, and every pair a chunk breaks adds to its momentum. From chain 3 (Clean) a match also breaks the same-suit tiles beside it, ' +
        'and their partners go with them. Sharp — about two-fifths of the floor\'s pairs of momentum, four at least — breaks the whole connected clump. Fever — about two-thirds, seven at least — takes the clump and everything touching it. ' +
        'Treasure inside a chunk spills and pays as if you had matched it. Broken pairs score less than matched ones and give no recall credit — memory still pays best — but they drop combo shards ' +
        'and clear the floor faster. A miss halves the chain and puts the fire out. ' +
        'A break with a shape gets a name on the run line: a partner taken from across the board, a halo, a treasure spill, a clean sweep of a suit. ' +
        'Clear the floor with momentum still standing and the end pays out: a gold at Clean and Sharp, a shard and two gold at Fever — Extreme Fever. Never score, never rating.'
} as const;
