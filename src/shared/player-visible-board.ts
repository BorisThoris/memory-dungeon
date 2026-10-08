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
 * - a Turncoat face down wears the element it was dealt (`turncoatDealt`) and shows no badge, so
 *   its turning cannot be watched from across the board; its face shows what it is now and what
 *   it turns to next.
 *
 * Every renderer path that draws or describes a face-down card is handed this board, so a new
 * marker cannot leak by forgetting a check. The rules keep the whole board.
 */

/** The fields that mark a face-down card as one particular pair's. */
const PAIR_IDENTITY_FIELDS = ['findableKind', 'tileTraitKind', 'hourglass', 'turncoat', 'turncoatDealt'] as const;

export const playerVisibleTile = (tile: Tile): Tile => {
    if (tile.state !== 'hidden') return tile;
    if (!PAIR_IDENTITY_FIELDS.some((field) => tile[field] != null)) return tile;
    const { findableKind: _f, tileTraitKind: _t, hourglass: _h, turncoat: _c, turncoatDealt, ...rest } = tile;
    return turncoatDealt != null ? { ...rest, suit: turncoatDealt } : rest;
};

export const playerVisibleBoard = (board: BoardState): BoardState => {
    let changed = false;
    const tiles = board.tiles.map((tile) => {
        const visible = playerVisibleTile(tile);
        if (visible !== tile) changed = true;
        return visible;
    });
    return changed ? { ...board, tiles } : board;
};
