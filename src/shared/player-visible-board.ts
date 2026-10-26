import type { BoardState, Tile } from './contracts';

/**
 * What the player can see of a board: the face-down cards stripped of anything that sets one pair
 * apart from the others (2026-10-08).
 *
 * The owner: "various things accidentally give away pairs ... pairs have dots and stuff sometimes on
 * the bottom right, or type switch cards are easily tellable pairs ... this all needs fixed." The
 * research behind the fix (tournament card rules, memory-game templates) agrees on one principle:
 * whatever shows before a flip has to be the same for every card a player could confuse it with,
 * and a difference only made subtle is still a marked card. So a face-down card shows its element
 * (shared by its whole suit: designed information) and the realm's marks on it (frost, fire, vines,
 * snow: things that happened to that one card, not to its pair), and nothing else:
 *
 * - a pickup (`findableKind`), a trait (`tileTraitKind`) and an Hourglass are on the face only:
 *   they are found by turning the card, and announced when they are;
 * - a Wanderer (`wanderer-rules.ts`) is a Wanderer on its face only: its step and footprint show it;
 * - a Sleeper (`sleeper-rules.ts`) is a Sleeper on its face only;
 * - a masked card (`mask-rules.ts`) face down wears its mask's element, until its first flip drops it;
 * - a Turncoat face down wears the element it was dealt (`turncoatDealt`) and shows no badge, so
 *   its turning cannot be watched from across the board; its face shows what it is now and what
 *   it turns to next.
 *
 * Every renderer path that draws or describes a face-down card is handed this board, so a new
 * marker cannot leak by forgetting a check. The rules keep the whole board.
 */

/** The fields that mark a face-down card as one particular pair's. */
const PAIR_IDENTITY_FIELDS = ['findableKind', 'tileTraitKind', 'hourglass', 'turncoat', 'turncoatDealt', 'wanderer', 'sleeper'] as const;

export const playerVisibleTile = (tile: Tile): Tile => {
    // Opposites (`match-rule-rules.ts`): the card shows its opposite element, face up as face down - the floor's told rule.
    if (tile.shownSuit != null) {
        const { shownSuit, ...rest } = tile;
        return playerVisibleTile({ ...rest, suit: shownSuit });
    }
    if (tile.state !== 'hidden') return tile;
    // A mask (`mask-rules.ts`) is the element the back shows: the screen is told the lie, never the truth.
    if (tile.mask != null) {
        const { mask, ...honest } = tile;
        return playerVisibleTile({ ...honest, suit: mask });
    }
    if (!PAIR_IDENTITY_FIELDS.some((field) => tile[field] != null)) return tile;
    const { findableKind: _f, tileTraitKind: _t, hourglass: _h, turncoat: _c, wanderer: _w, sleeper: _s, turncoatDealt, ...rest } = tile;
    return turncoatDealt != null ? { ...rest, suit: turncoatDealt } : rest;
};

/**
 * `chartBeneath`: the Cartographer's study window (`cartographer-rules.ts`) charts the lower deck, so each
 * waiting card shows its element - never its face or its pair.
 */
export const playerVisibleBoard = (board: BoardState, { chartBeneath = false }: { chartBeneath?: boolean } = {}): BoardState => {
    let changed = false;
    // Element pairs (`match-rule-rules.ts`): a back keeps its element to itself - the colour is what a player remembers.
    const elementPairs = board.matchRule === 'element_pairs';
    const tiles = board.tiles.map((tile) => {
        const seen = playerVisibleTile(tile);
        const visible = elementPairs && seen.state === 'hidden' && seen.suit != null ? (({ suit: _suit, ...rest }) => rest)(seen) : seen;
        if (visible !== tile) changed = true;
        return visible;
    });
    // Layers (`board-layers-rules.ts`): of the lower deck the screen learns only where a card waits, never
    // its face, its element or its pair; the rules keep the whole card.
    const beneath = board.beneath?.map((card) =>
        card ? { id: card.id, pairKey: '', symbol: '', label: '', state: 'hidden' as const, ...(chartBeneath && card.suit ? { suit: card.suit } : {}) } : null
    );
    if (beneath) return { ...board, tiles, beneath };
    return changed ? { ...board, tiles } : board;
};
