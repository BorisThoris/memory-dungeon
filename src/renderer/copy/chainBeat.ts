import type { ChainTier } from '../../shared/chain-tier-rules';
import { CHAIN_RUNG_PAIRS } from '../../shared/chain-rung-value-rules';

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

/** One rung's worth, as a sentence. Module-level so the meter's own label can reuse it. */
const rungValueLine = (tier: ChainTier): string => {
    const pairs = CHAIN_RUNG_PAIRS[tier];
    const at = tier === 'none' ? 'A match with no chain' : `A ${CHAIN_TIER_LABELS[tier]} break`;
    return `${at} takes about ${pairs} ${pairs === 1 ? 'pair' : 'pairs'} with it.`;
};

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
    /**
     * The clump read on a considered tile: what it stands in, what a match there pops **now**, and
     * what the next rung would add. The second half is the hold decision (thesis §30.3b) said on
     * the tile the player is deciding about: spend it here for this, or hold it for that.
     */
    clumpRead: (
        suitName: string,
        size: number,
        now: { pairs: number },
        next: { tier: ChainTier; addedPairs: number; pairs: number } | null
    ): string => {
        const pairs = (count: number): string => `${count} ${count === 1 ? 'pair' : 'pairs'}`;
        const nowLine = now.pairs > 0 ? `this match pops ${pairs(now.pairs)}` : 'this match pops nothing';
        const nextLine =
            next == null
                ? ''
                : next.addedPairs > 0
                  ? `; ${pairs(next.pairs)} at ${CHAIN_TIER_LABELS[next.tier]}`
                  : `; ${CHAIN_TIER_LABELS[next.tier]} reaches no further here`;
        return `${suitName} clump of ${size} — ${nowLine}${nextLine}.`;
    },
    /**
     * The style line: what made this break worth a name. Peggle labels the shot ("Long shot",
     * "Lucky bounce") so the player can own it; one line, only the tags that apply, or nothing.
     */
    styleLine: (style: {
        chunkPartnerSpanMax: number;
        chunkHaloPairs: number;
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
        if (style.chunkSuitCleared) tags.push('Clean sweep');
        return tags.length === 0 ? null : `${tags.join(', ')}.`;
    },
    /** Hover on the chain stat: what the tier is made of and where the next rungs sit on this floor. */
    momentumHint: (chain: number, cascaded: number, rungs: { sharp: number; fever: number }): string =>
        `${cascaded > 0 ? `Chain ${chain} plus ${cascaded} cascaded, momentum ${chain + cascaded}` : `Chain ${chain}`}. ` +
        `Every match pops the clump it touches. Clean from 3 lets the partners ripple, Sharp from ${rungs.sharp} runs the reaction out, Fever from ${rungs.fever} adds the halo on this floor. A miss halves the chain and puts the fire out.`,
    /**
     * What the rung the player is standing on is worth, for the pip cluster beside the tier. The
     * meter said where they were and never what being there bought (thesis §30.3a); a cluster that
     * grows as they climb is how "Sharp takes about this many" is learned by seeing it.
     */
    rungValue: rungValueLine,
    /** The whole ladder in one line, for the hover hint: what each rung up is worth. */
    rungLadder: (): string =>
        `A lone match takes about ${CHAIN_RUNG_PAIRS.none} pairs, Clean ${CHAIN_RUNG_PAIRS.clean}, ` +
        `Sharp ${CHAIN_RUNG_PAIRS.sharp}, Fever ${CHAIN_RUNG_PAIRS.fever}.`,
    /** The meter, for a screen reader: where the momentum stands on the ladder, and what it is worth. */
    meterLabel: (momentum: number, feverAt: number, full: boolean, tier: ChainTier): string =>
        `${full ? `Fever meter full: momentum ${momentum}.` : `Fever meter: momentum ${momentum} of ${feverAt}.`}` +
        ` ${rungValueLine(tier)}`,
    codexChainTitle: 'Chain, chunk and Fever',
    codexChainDescription:
        'Every match pops: the whole same-suit clump touching the two tiles you matched breaks away with them, and the partners of those pairs go too, wherever they sit. ' +
        'The chain decides how far the pops ripple. With no chain the partners leave and stop. From chain 3 (Clean) each partner that left takes its own clump - a second wave. ' +
        'Sharp - about two-fifths of the floor\'s pairs of momentum, four at least - runs the reaction until a wave takes nothing. Fever - about two-thirds, seven at least - adds the halo: everything touching the first clump, whatever its suit. ' +
        'Every pair a break takes adds to the chain\'s momentum. Treasure inside a break spills and pays as if you had matched it. Broken pairs score less than matched ones and give no recall credit - memory still pays best - but they ' +
        'clear the floor faster, and a longer ripple pays more. A miss halves the chain and puts the fire out. ' +
        'A break with a shape gets a name on the run line: a ripple that ran on, a drop, a partner taken from across the board, a halo, a treasure spill, a clean sweep of a suit. ' +
        'Clear the floor with momentum still standing and the floor-end bonus multiplies with it: 1.5x at Clean, 2.5x at Sharp, 5x at Fever - Extreme Fever.'
} as const;
