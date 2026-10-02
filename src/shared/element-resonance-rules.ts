import type { RunState, Tile, TileSuit } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { tileCharge } from './element-alchemy-rules';

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
    steam: { kind: 'steam', name: 'Steam', elements: ['ember', 'tide'], effect: 'the p face-down cards nearest the match show their faces until the next flip' },
    blaze: { kind: 'blaze', name: 'Blaze', elements: ['ember', 'moss'], effect: 'every vine and bloom burns away, and it pays a gold for every two of p, rounded up' },
    melt: { kind: 'melt', name: 'Thaw', elements: ['ember', 'bone'], effect: 'every card is freed of ice and snow, and it scores 25 times p squared' },
    freezeover: { kind: 'freezeover', name: 'Freeze-over', elements: ['tide', 'bone'], effect: 'the floor holds still for p + 1 turns: no weather, no backlash, no frostbite, no fuse burns down' },
    flood: { kind: 'flood', name: 'Flood', elements: ['tide', 'moss'], effect: 'both elements gain p resonance' },
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
    reaction: { definition: ElementReactionDefinition; potency: number; spent: ElementStreak } | null;
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
    const definition = streak && streak.suit !== suit && isStreakPrimed(streak) ? elementReactionOf(streak.suit, suit) : null;
    const reaction = definition && streak ? { definition, potency: reactionPotency(streak, resonance, stormDepth), spent: streak } : null;
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
export const resolveElementReaction = (kind: ElementReactionKind, potency: number, tiles: Tile[], nearest: readonly number[]): ElementReactionOutcome => {
    const p = Math.max(1, runNonNegativeInteger(potency));
    const outcome: ElementReactionOutcome = { kind, potency: p, touchedTileIds: [], litTileIds: [], gold: 0, score: 0, stillTurns: 0, resonanceGain: 0 };
    switch (kind) {
        case 'steam':
            outcome.litTileIds = nearest.slice(0, p).map((index) => tiles[index]!.id);
            outcome.touchedTileIds = [...outcome.litTileIds];
            break;
        case 'blaze':
            tiles.forEach((tile, index) => {
                if (tile.state !== 'hidden' || (tile.vined == null && tile.bloom == null)) return;
                const { vined: _vined, bloom: _bloom, ...rest } = tile;
                tiles[index] = rest;
                outcome.touchedTileIds.push(tile.id);
            });
            outcome.gold = Math.ceil(p / BLAZE_POTENCY_PER_GOLD);
            break;
        case 'melt':
            tiles.forEach((tile, index) => {
                if (tile.state !== 'hidden' || (tile.frost == null && tile.snowed == null)) return;
                const { frost: _frost, snowed: _snowed, ...rest } = tile;
                tiles[index] = rest;
                outcome.touchedTileIds.push(tile.id);
            });
            outcome.score = THAW_SCORE_PER_POTENCY_SQUARED * p * p;
            break;
        case 'freezeover':
            outcome.stillTurns = p + 1;
            break;
        case 'flood':
            outcome.resonanceGain = p;
            break;
        case 'frostbloom':
            for (const index of nearest.slice(0, p)) {
                const tile = tiles[index]!;
                if (!isElemental(tile)) continue;
                tiles[index] = { ...tile, empowered: tileCharge(tile) + 1 };
                outcome.touchedTileIds.push(tile.id);
            }
            break;
    }
    return outcome;
};
