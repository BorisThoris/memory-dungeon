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
    codexChainTitle: 'Chain, chunk and Fever',
    codexChainDescription:
        'Every correct match in a row raises your chain. From chain 2 (Clean) a match also breaks the same-suit tiles beside it, ' +
        'and their partners go with them. From chain 5 (Sharp) the whole connected clump goes. At chain 8 it is Fever. ' +
        'Broken pairs score less than matched ones and give no recall credit — memory still pays best — but they drop combo shards ' +
        'and clear the floor faster. A miss drops the chain to zero.'
} as const;
