import type { ChainTier } from '../../shared/chain-tier-rules';
import { chainRungScoreMultiplier } from '../../shared/chain-rung-value-rules';
import { breakPairCap } from '../../shared/chunk-break-rules';
import type { BoardState } from '../../shared/contracts';

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

/** Grid steps between a broken pair's halves that earn "Long clump": a wave that ran a long way. */
export const CHAIN_STYLE_LONG_SPAN = 4;

const extraPairs = (count: number): string => `${count} extra ${count === 1 ? 'pair' : 'pairs'}`;

/**
 * Explain the live limit, not the simulation's average number of extra pairs. An average of zero
 * at Lone used to say the player's match took zero pairs; Clean and Sharp both rounded to one.
 * The matched pair is separate, and a breather raises the limit even before Clean.
 */
const rungValueLine = (tier: ChainTier, archetype?: BoardState['floorArchetypeId']): string => {
    const pairs = breakPairCap(tier, archetype);
    if (pairs === 0) return 'Your match clears its pair. Reach Clean to start popping nearby pairs.';
    const at = tier === 'none' ? 'On this breather, a match' : `${CHAIN_TIER_LABELS[tier]}`;
    return `${at} can pop up to ${extraPairs(pairs)} by contact. Popped pairs score ×${chainRungScoreMultiplier(tier)} before ripple bonuses.`;
};

/**
 * What the momentum number is made of, named source by source.
 * 
 * Momentum stopped being one thing when the study skip started paying it: a player reading
 * "momentum 5" with a streak of 3 deserves to know whether the other two came off the board or
 * out of the clock they handed back. The sources are listed only when they are non-zero, so an
 * ordinary chain still reads as the single number it is.
 */
const momentumSourceLine = (chain: number, cascaded: number, banked: number): string => {
    const extra: string[] = [];
    if (cascaded > 0) extra.push(`${cascaded} cascaded`);
    if (banked > 0) extra.push(`${banked} banked from an early start`);
    return extra.length === 0
        ? `Chain ${chain}`
        : `Chain ${chain} plus ${extra.join(' and ')}, momentum ${chain + cascaded + banked}`;
};

export const CHAIN_BEAT_COPY = {
    /**
     * The HUD's standing goal under the stat row: how far the next rung is and what standing on
     * it buys. `null` is the top of the ladder, where the goal is to stay there.
     */
    goalLabel: (momentumLeft: number, nextTier: Exclude<ChainTier, 'none'> | null): string =>
        nextTier ? `${momentumLeft} momentum to ${CHAIN_TIER_LABELS[nextTier]}` : 'Fever active',
    goalBenefit: (nextTier: Exclude<ChainTier, 'none'> | null): string =>
        nextTier === 'clean'
            ? 'Matches can pop a nearby pair'
            : nextTier === 'sharp'
              ? 'A break can pop two extra pairs and run on'
              : nextTier === 'fever'
                ? 'A break can pop four extra pairs and bridge suits'
                : 'Keep matching to hold the fire',
    /**
     * The break's line: the one the feedback rail shows and a screen reader speaks, so it has to
     * carry size and cause in one sentence. A break with no chain behind it is the pop.
     */
    chunkAnnouncement: (pairs: number, tier: ChainTier, chain: number): string =>
        tier === 'none'
            ? `Pop. ${extraPairs(pairs)} broke away with that match and left the board.`
            : `Chain ${chain}, ${CHAIN_TIER_LABELS[tier]} break. ${pairs} more ${
                  pairs === 1 ? 'pair' : 'pairs'
              } broke away with that match and left the board.`,
    /**
     * The clump read on a considered tile: what it stands in, what a match there pops **now**, and
     * what the next rung would add. The second half is the hold decision (thesis §30.3b) said on
     * the tile the player is deciding about: spend it here for this, or hold it for that.
     */
    clumpRead: (
        suitName: string,
        size: number,
        now: { pairs: number },
        next: { tier: ChainTier; addedPairs: number; pairs: number } | null,
        elemental?: { reacts: boolean }
    ): string => {
        const pairs = (count: number): string => `${count} ${count === 1 ? 'pair' : 'pairs'}`;
        // On a realm floor the pop is the reaction's (`elementPopSpec`).
        if (elemental) {
            return elemental.reacts
                ? `${suitName} — a match here reacts with the element in hand and bursts ${pairs(now.pairs)}.`
                : `${suitName} — a match here takes its own pair. Match one element twice, then another, and they react.`;
        }
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
        chunkBridgedPairs: number;
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
        if (style.chunkPartnerSpanMax >= CHAIN_STYLE_LONG_SPAN) tags.push('Long clump');
        if (style.chunkBridgedPairs > 0) tags.push('Bridge');
        if (style.chunkSuitCleared) tags.push('Clean sweep');
        return tags.length === 0 ? null : `${tags.join(', ')}.`;
    },
    /** Hover on the chain stat: what the tier is made of and where the next rungs sit on this floor. */
    momentumHint: (
        chain: number,
        cascaded: number,
        banked: number,
        rungs: { sharp: number; fever: number },
        archetype?: BoardState['floorArchetypeId']
    ): string =>
        `${momentumSourceLine(chain, cascaded, banked)}. ` +
        (archetype === 'breather' ? 'This breather lets every rung pop one more pair. ' : 'A match on its own clears its pair. ') +
        `Clean from 3 can pop up to ${extraPairs(breakPairCap('clean', archetype))} by contact, Sharp from ${rungs.sharp} up to ${breakPairCap('sharp', archetype)} and can ripple, Fever from ${rungs.fever} up to ${breakPairCap('fever', archetype)} and can bridge into a neighbouring suit. A miss ends the chain and clears cascade and early-start momentum; nothing else does, so the whole ladder crosses floors with the combo.`,
    /** What this floor's rung can add to a remembered pair, and how those extra pairs score. */
    rungValue: rungValueLine,
    /** The whole ladder in one line, for the hover hint: what each rung up pays. */
    rungLadder: (): string =>
        `Popped-pair score: Lone ×${chainRungScoreMultiplier('none')}, Clean ×${chainRungScoreMultiplier('clean')}, ` +
        `Sharp ×${chainRungScoreMultiplier('sharp')}, Fever ×${chainRungScoreMultiplier('fever')}.`,
    /** The meter, for a screen reader: where the momentum stands on the ladder, and what it is worth. */
    meterLabel: (momentum: number, feverAt: number, full: boolean, tier: ChainTier, archetype?: BoardState['floorArchetypeId']): string =>
        `${full ? `Fever meter full: momentum ${momentum}.` : `Fever meter: momentum ${momentum} of ${feverAt}.`}` +
        ` ${rungValueLine(tier, archetype)}`
} as const;
