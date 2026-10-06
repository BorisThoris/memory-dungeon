import type { ElementReactionImpact, RunState, Tile, TileSuit } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { tileCharge, type AlchemyLog } from './element-alchemy-rules';

/**
 * Resonance, the streak and the reactions (2026-10-02): the elements stack without end, and two of
 * them meeting does something.
 *
 * The owner: "expand the elemental system even more, make them infinitely stacking. If you keep
 * picking the same zone/element it should infinitely stack ... The alchemy combination system also
 * isn't really impactful." Until now an empowered card was a yes or a no, attunement stopped at
 * three, and an element met a card only where it would have acted, so the order a player matched
 * the elements in bought nothing. Three things answer that here (the realm's depth is in
 * `realm-carryover-rules.ts`):
 *
 * - **Resonance** (`RunState.elementResonance`): every pair matched of an element is a stack of it
 *   for the run, with no cap, and a charged card matched adds its charge. A stack is score on that
 *   element's matches; every tier (`resonanceTier`: 2, 6, 12, 20, 30 ... stacks) widens the
 *   element's cast by a step. A missed card sheds a stack of its element.
 * - **The streak** (`RunState.elementStreak`): the element in hand and the matches made of it in a
 *   row (a link a turn, however many pairs its pop took), carried between floors. A miss breaks it.
 *   At `STREAK_PRIMED` links it is primed.
 * - **Reactions**: matching a different element while the streak is primed spends it. The two
 *   elements react (`ELEMENT_REACTIONS`), with a potency of the streak's links, plus half the spent
 *   element's tier, plus half the storm's depth (the Thunder Spire has no element: it is the
 *   catalyst). Six pairs, six reactions, six different resources.
 *
 * Measured 2026-10-02 (soak, 60 seeds): a streak counted in pairs was primed by any pop, and 42% of
 * all turns reacted; counted in turns it is a thing the player does on purpose.
 *
 * So a turn is a choice the backs of the cards let the player make: the same element again, and
 * deeper, or a different one now, and the reaction.
 */

export type ElementResonance = Partial<Record<TileSuit, number>>;

export interface ElementStreak {
    suit: TileSuit;
    /** Matches of the element in a row: one a turn. */
    links: number;
}

/** Score a matched pair earns per stack of its element. */
export const RESONANCE_SCORE_PER_STACK = 3;
/** Matches in a row that prime the streak: a different element matched next reacts with it. */
export const STREAK_PRIMED = 2;
/** Blaze pays a gold for every this much potency, rounded up. */
export const BLAZE_POTENCY_PER_GOLD = 2;
/** Thaw pays this times the potency squared. */
export const THAW_SCORE_PER_POTENCY_SQUARED = 25;

export const runElementResonance = (run: Pick<RunState, 'elementResonance'>): ElementResonance => run.elementResonance ?? {};

export const resonanceOf = (resonance: ElementResonance, suit: TileSuit): number => runNonNegativeInteger(resonance[suit] ?? 0);

/** The tier a stack count has reached: tier T at T(T+1) stacks (2, 6, 12, 20, 30 ...), without end. */
export const resonanceTier = (stacks: number): number => Math.floor((Math.sqrt(1 + 4 * runNonNegativeInteger(stacks)) - 1) / 2);

/** Stacks the next tier is reached at. */
export const stacksForTier = (tier: number): number => runNonNegativeInteger(tier) * (runNonNegativeInteger(tier) + 1);

export const runElementStreak = (run: Pick<RunState, 'elementStreak'>): ElementStreak | null => {
    const streak = run.elementStreak;
    return streak && streak.suit && runNonNegativeInteger(streak.links) > 0 ? { suit: streak.suit, links: runNonNegativeInteger(streak.links) } : null;
};

export const isStreakPrimed = (streak: ElementStreak | null): boolean => streak != null && streak.links >= STREAK_PRIMED;

export type ElementReactionKind = 'steam' | 'blaze' | 'melt' | 'freezeover' | 'flood' | 'frostbloom';

export interface ElementReactionDefinition {
    kind: ElementReactionKind;
    name: string;
    /** The two elements that make it, in the suit order. */
    elements: readonly [TileSuit, TileSuit];
    /** What it does, with the potency as `p`, for the Codex and the hall. */
    effect: string;
}

export const ELEMENT_REACTIONS: Readonly<Record<ElementReactionKind, ElementReactionDefinition>> = {
    steam: { kind: 'steam', name: 'Steam', elements: ['ember', 'tide'], effect: 'douse fires and reveal p nearby faces until the next flip' },
    blaze: { kind: 'blaze', name: 'Blaze', elements: ['ember', 'moss'], effect: 'burn vines, seeds and blooms; gain one gold per two power, rounded up' },
    melt: { kind: 'melt', name: 'Thaw', elements: ['ember', 'bone'], effect: 'melt ice, snow and rime; gain 25 × p² score' },
    freezeover: { kind: 'freezeover', name: 'Freeze-over', elements: ['tide', 'bone'], effect: 'douse fires and calm the arena for p + 1 turns' },
    flood: { kind: 'flood', name: 'Flood', elements: ['tide', 'moss'], effect: 'ripen seeds into 2-gold blooms; Water and Grove each gain p resonance' },
    frostbloom: { kind: 'frostbloom', name: 'Frostbloom', elements: ['moss', 'bone'], effect: 'the p face-down cards nearest the match each gain a charge' }
};

export const ELEMENT_REACTION_KINDS = Object.keys(ELEMENT_REACTIONS) as ElementReactionKind[];

/** The reaction two different elements make, whichever came first; null for one element twice. */
export const elementReactionOf = (a: TileSuit, b: TileSuit): ElementReactionDefinition | null => {
    if (a === b) return null;
    return ELEMENT_REACTION_KINDS.map((kind) => ELEMENT_REACTIONS[kind]).find(({ elements }) => elements.includes(a) && elements.includes(b)) ?? null;
};

/** A reaction's potency: the primed streak, half the spent element's tier, and half the storm's depth. */
export const reactionPotency = (streak: ElementStreak, resonance: ElementResonance, stormDepth: number): number =>
    streak.links + Math.floor(resonanceTier(resonanceOf(resonance, streak.suit)) / 2) + Math.floor(runNonNegativeInteger(stormDepth) / 2);

/** The run fields the elements read: where the floor is, what is in hand, what has stacked. */
export type ElementRunFields = Pick<RunState, 'realmId' | 'elementStreak' | 'elementResonance' | 'realmAttunement'>;

export interface PendingElementReaction {
    definition: ElementReactionDefinition;
    potency: number;
    spent: ElementStreak;
}

/** The reaction a match of `suit` would set off on this streak and these stacks, or null. */
export const reactionFor = (streak: ElementStreak | null, resonance: ElementResonance, stormDepth: number, suit: TileSuit | null | undefined): PendingElementReaction | null => {
    if (!suit || !streak || streak.suit === suit || !isStreakPrimed(streak)) return null;
    const definition = elementReactionOf(streak.suit, suit);
    return definition ? { definition, potency: reactionPotency(streak, resonance, stormDepth), spent: streak } : null;
};

/** The reaction the run's next match of `suit` would set off: the turn's, and the preview's. */
export const pendingElementReaction = (run: Partial<ElementRunFields>, suit: TileSuit | null | undefined): PendingElementReaction | null =>
    reactionFor(runElementStreak({ elementStreak: run.elementStreak }), runElementResonance({ elementResonance: run.elementResonance }), runNonNegativeInteger(run.realmAttunement?.storm ?? 0), suit);

/**
 * The pop is the reaction's (2026-10-02). The owner, shown resonance and the reactions: "this
 * should remove the chain reaction of cards popping/matching together" - and, asked which way, that
 * the reactions should do the popping. Until then every match popped the cards of its element it
 * was touching (`chunk-break-rules.ts`), which made the reaction one more thing happening on a
 * turn that already cleared two thirds of the floor (`yarn sim:pop-share`: matched share 0.34). Now,
 * on a realm floor, a plain match takes its own pair and nothing else, and a match that reacts
 * bursts both of the elements that met: as many pairs of each as the reaction's potency, the
 * nearest to the match first. So the pop is earned twice over - the same element again to prime,
 * then the other one - and it grows with everything that grows the potency, without a cap.
 *
 * Measured before it was settled (soak, 30 seeds): keeping the old contact rule on the matched
 * element's clump, 42% of reactions popped nothing at all, because a clump with both halves of a
 * pair in it was seldom touching the match; doubling its reach changed nothing. A reaction has to
 * do what its stamp says every time, so it takes the nearest pairs of its two elements instead.
 *
 * `undefined`: a run with no realm (fixtures, the census, a save from before realms), which keeps
 * the pop it was built on. `null`: a realm floor and no reaction in hand, so nothing pops.
 */
export interface ElementPopSpec {
    /** The two elements that met, and the pairs of each the reaction bursts. */
    suits: readonly TileSuit[];
    pairsPerSuit: number;
}

/** Pairs of each reacting element a reaction bursts for each point of its potency. */
export const REACTION_POP_PAIRS_PER_POTENCY = 1;

export const elementPopSpec = (run: Partial<ElementRunFields>, suit: TileSuit | null | undefined): ElementPopSpec | null | undefined => {
    if (run.realmId == null) return undefined;
    const pending = pendingElementReaction(run, suit);
    return pending ? { suits: pending.definition.elements, pairsPerSuit: pending.potency * REACTION_POP_PAIRS_PER_POTENCY } : null;
};

const isElemental = (tile: Tile | undefined): tile is Tile & { suit: TileSuit } =>
    tile != null && tile.suit != null && !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey);

export interface ResonanceTurn {
    resonance: ElementResonance;
    streak: ElementStreak | null;
    /** Score the turn's stacks paid (a match), on the stacks the element held before it. */
    score: number;
    /** Stacks gained this turn (a match), or shed (a miss). */
    gained: number;
    shed: number;
    /** The reaction the turn set off, and its potency, before it is carried out. */
    reaction: PendingElementReaction | null;
}

/**
 * The stacks and the streak after a match. `pairsBySuit` is the pair matched and every pair the pop
 * took (one element); `matchedTiles` are those cards as they were turned, for their charge;
 * `extraPerPair` is the realm's depth resonating its own element (`realmResonanceBonus`).
 */
export const resonanceAfterMatch = ({
    resonance,
    streak,
    pairsBySuit,
    matchedTiles,
    extraPerPair = 0,
    stormDepth = 0
}: {
    resonance: ElementResonance;
    streak: ElementStreak | null;
    pairsBySuit: ElementResonance;
    matchedTiles: readonly Tile[];
    extraPerPair?: number;
    stormDepth?: number;
}): ResonanceTurn => {
    const suit = (Object.keys(pairsBySuit) as TileSuit[]).find((key) => runNonNegativeInteger(pairsBySuit[key] ?? 0) > 0);
    if (!suit) return { resonance, streak, score: 0, gained: 0, shed: 0, reaction: null };
    const pairs = runNonNegativeInteger(pairsBySuit[suit] ?? 0);
    const before = resonanceOf(resonance, suit);
    const charge = matchedTiles.filter((tile) => isElemental(tile) && tile.suit === suit).reduce((sum, tile) => sum + tileCharge(tile), 0);
    const gained = pairs * (1 + runNonNegativeInteger(extraPerPair)) + charge;
    const next: ElementResonance = { ...resonance, [suit]: before + gained };
    // A reaction bursts pairs of the element it spent too: those are stacks of that element.
    for (const other of Object.keys(pairsBySuit) as TileSuit[]) {
        if (other !== suit) next[other] = resonanceOf(next, other) + runNonNegativeInteger(pairsBySuit[other] ?? 0);
    }
    const reaction = reactionFor(streak, resonance, stormDepth, suit);
    return {
        resonance: next,
        streak: streak && streak.suit === suit ? { suit, links: streak.links + 1 } : { suit, links: 1 },
        score: pairs * before * RESONANCE_SCORE_PER_STACK,
        gained,
        shed: 0,
        reaction
    };
};

/** A miss: the streak breaks, and each missed card sheds a stack of its element. */
export const resonanceAfterMiss = (resonance: ElementResonance, missedTiles: readonly Tile[]): ResonanceTurn => {
    const next: ElementResonance = { ...resonance };
    let shed = 0;
    for (const tile of missedTiles) {
        if (!isElemental(tile)) continue;
        const stacks = resonanceOf(next, tile.suit);
        if (stacks === 0) continue;
        next[tile.suit] = stacks - 1;
        shed += 1;
    }
    return { resonance: shed > 0 ? next : resonance, streak: null, score: 0, gained: 0, shed, reaction: null };
};

export interface ElementReactionOutcome {
    changes: ElementReactionImpact['changes'];
    kind: ElementReactionKind;
    potency: number;
    /** The cards it changed, lit or charged. */
    touchedTileIds: string[];
    litTileIds: string[];
    gold: number;
    score: number;
    /** Turns the floor holds still for (Freeze-over), and resonance both elements gain (Flood). */
    stillTurns: number;
    resonanceGain: number;
}

/**
 * Carry a reaction out on `tiles` (mutated in place, like the realm's other steps). `nearest` are
 * the face-down real cards around the match, nearest first.
 */
export const resolveElementReaction = (kind: ElementReactionKind, potency: number, tiles: Tile[], nearest: readonly number[], alchemy?: AlchemyLog): ElementReactionOutcome => {
    const p = Math.max(1, runNonNegativeInteger(potency));
    const outcome: ElementReactionOutcome = { kind, potency: p, changes: [], touchedTileIds: [], litTileIds: [], gold: 0, score: 0, stillTurns: 0, resonanceGain: 0 };
    // The same recipe applies to local ground and amplified reactions. Only scope and power differ.
    const scope = [...new Set(nearest)].filter(index => tiles[index]?.state === 'hidden' && isElemental(tiles[index]));
    const clear = (keys: readonly ('fuse' | 'vined' | 'bloom' | 'seeded' | 'frost' | 'snowed' | 'rime')[], effect: ElementReactionImpact['changes'][number]['effect']) => {
        for (const index of scope) {
            const tile = tiles[index]!;
            if (!keys.some(key => tile[key] != null)) continue;
            const next = { ...tile };
            for (const key of keys) delete next[key];
            tiles[index] = next;
            outcome.touchedTileIds.push(tile.id);
            outcome.changes.push({ tileId: tile.id, effect });
        }
    };
    switch (kind) {
        case 'steam':
            clear(['fuse'], 'doused');
            outcome.litTileIds = scope.slice(0, p).map(index => tiles[index]!.id);
            outcome.touchedTileIds.push(...outcome.litTileIds);
            outcome.changes.push(...outcome.litTileIds.map(tileId => ({ tileId, effect: 'revealed' as const })));
            break;
        case 'blaze':
            clear(['vined', 'bloom', 'seeded'], 'growth-cleared');
            outcome.gold = Math.ceil(p / BLAZE_POTENCY_PER_GOLD);
            break;
        case 'melt':
            clear(['frost', 'snowed', 'rime'], 'thawed');
            outcome.score = THAW_SCORE_PER_POTENCY_SQUARED * p * p;
            break;
        case 'freezeover':
            clear(['fuse'], 'doused');
            outcome.stillTurns = p + 1;
            break;
        case 'flood':
            for (const index of scope) {
                const tile = tiles[index]!;
                if (tile.seeded !== 1) continue;
                tiles[index] = { ...tile, seeded: 2 };
                outcome.touchedTileIds.push(tile.id);
                outcome.changes.push({ tileId: tile.id, effect: 'ripened' });
            }
            outcome.resonanceGain = p;
            break;
        case 'frostbloom':
            for (const index of scope.filter(index => !alchemy?.empowered.includes(tiles[index]!.id)).slice(0, p)) {
                const tile = tiles[index]!;
                tiles[index] = { ...tile, empowered: tileCharge(tile) + 1 };
                alchemy?.empowered.push(tile.id);
                outcome.touchedTileIds.push(tile.id);
                outcome.changes.push({ tileId: tile.id, effect: 'charged' });
            }
            break;
    }
    outcome.touchedTileIds = [...new Set(outcome.touchedTileIds)];
    return outcome;
};

/** Player-facing receipt and preview use the exact power passed to the resolver. */
export const elementReactionSummary = (kind: ElementReactionKind, potency: number): string => {
    const p = Math.max(1, runNonNegativeInteger(potency));
    return {
        steam: `Douse fire · reveal up to ${p} ${p === 1 ? 'face' : 'faces'}`,
        blaze: `Burn vines, seeds and blooms · +${Math.ceil(p / BLAZE_POTENCY_PER_GOLD)} gold`,
        melt: `Melt ice, snow and rime · +${THAW_SCORE_PER_POTENCY_SQUARED * p * p} score`,
        freezeover: `Douse fire · calm arena for ${p + 1} turns`,
        flood: `Ripen seeds · +${p} Water and Grove resonance`,
        frostbloom: `Charge up to ${p} ${p === 1 ? 'card' : 'cards'} · charges add resonance when matched`
    }[kind];
};
