import type { RealmId, RunState, Tile, TileSuit } from './contracts';
import { isSingletonUtilityPairKey, isWildPairKey } from './tile-identity';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The sway: the player's matches tip the world (2026-10-01).
 *
 * The owner's first ask for the realms was that the cards change the world, not only the world the
 * cards. Omens did it with one marked pair a floor; the sway does it with everything the player
 * matches. Every card's back carries one of four suits, and each suit belongs to a realm: ember to
 * the Cinder Deep, tide to the Drowned Vault, moss to the Overgrown Crypt, bone to the Frozen Reach.
 * Every pair matched of a suit whose realm the floor is NOT in (pops included) leans the world
 * toward it; at `REALM_SWAY_TIP` pairs of one suit the floor tips into that realm, the way an omen
 * turns it, with the same reaction, keeping its severity.
 *
 * The sway carries between floors with the combo and, like the combo, a miss wipes it: chasing a
 * suit is a clean chain's privilege (`scripts/` probe 2026-10-01: at 5, careful play tipped about a
 * fifth of realm floors, sloppy play none, early in the floor because the sway arrived carried).
 * Once a floor at most; a tip empties the sway. The storm has no suit: a floor can be tipped out of
 * the Thunder Spire but never into it. Unlike an omen's reaction a tip clears nothing and pays
 * nothing: what the old weather left stays on the board.
 */

export const SUIT_REALM: Readonly<Record<TileSuit, RealmId>> = {
    ember: 'ember',
    tide: 'tide',
    moss: 'grove',
    bone: 'frost'
};

const SUIT_ORDER: readonly TileSuit[] = ['ember', 'tide', 'moss', 'bone'];

/** Pairs of one off-realm suit that tip the floor. */
export const REALM_SWAY_TIP = 5;
/** Tips a floor allows. */
export const REALM_SWAY_TIPS_PER_FLOOR = 1;

export type RealmSway = Partial<Record<TileSuit, number>>;

export const runRealmSway = (run: Pick<RunState, 'realmSway'>): RealmSway => run.realmSway ?? {};

/** The suit a matched pair counts for: none for the joker, a singleton or a card without a suit. */
export const swaySuitOf = (tile: Tile | undefined): TileSuit | null =>
    tile && tile.suit && !isSingletonUtilityPairKey(tile.pairKey) && !isWildPairKey(tile.pairKey) ? tile.suit : null;

/** The sway after a turn: a miss wipes it; a match adds its pairs, by suit, for suits off the floor's realm. */
export const swayAfterTurn = (
    sway: RealmSway,
    realmId: RealmId | null,
    outcome: 'match' | 'miss',
    pairsBySuit: RealmSway
): RealmSway => {
    if (outcome === 'miss') return {};
    const next: RealmSway = { ...sway };
    for (const suit of SUIT_ORDER) {
        const pairs = runNonNegativeInteger(pairsBySuit[suit] ?? 0);
        if (pairs === 0 || SUIT_REALM[suit] === realmId) continue;
        next[suit] = runNonNegativeInteger(next[suit] ?? 0) + pairs;
    }
    return next;
};

export interface SwayLead {
    suit: TileSuit;
    realm: RealmId;
    pairs: number;
}

/** The suit leaning hardest away from the floor's realm, if any; ties go to the suit order. */
export const leadingSway = (sway: RealmSway, realmId: RealmId | null): SwayLead | null => {
    let lead: SwayLead | null = null;
    for (const suit of SUIT_ORDER) {
        const pairs = runNonNegativeInteger(sway[suit] ?? 0);
        if (pairs === 0 || SUIT_REALM[suit] === realmId) continue;
        if (!lead || pairs > lead.pairs) lead = { suit, realm: SUIT_REALM[suit], pairs };
    }
    return lead;
};

/** The realm the sway tips the floor into this turn, or null. */
export const swayTip = (sway: RealmSway, realmId: RealmId | null, tipsThisFloor: number): RealmId | null => {
    if (!realmId || runNonNegativeInteger(tipsThisFloor) >= REALM_SWAY_TIPS_PER_FLOOR) return null;
    const lead = leadingSway(sway, realmId);
    return lead && lead.pairs >= REALM_SWAY_TIP ? lead.realm : null;
};
