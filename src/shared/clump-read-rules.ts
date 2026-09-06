import type { BoardState, Tile, TileSuit } from './contracts';
import { findSuitRegion, tileCanBreakInChunk, tileIsChunkTreasure } from './chunk-break-rules';

/**
 * The clump read: what a hidden tile is standing in, before the player commits to it.
 *
 * A bubble shooter draws the aim line; here the plan is the suits on the backs, and nothing said
 * how big a clump was. This reads the connected same-suit region a tile belongs to and how many
 * pairs a Sharp break there would take — the same region rule the break uses, so the read is the
 * truth of the board and not an estimate of it. Read on focus, under the pointer, on the first
 * flipped tile, and by the skull.
 */
export interface ClumpRead {
    suit: TileSuit;
    /** Hidden tiles in the clump, the read tile included. */
    size: number;
    /** Every tile id in the clump, for the board to outline. */
    tileIds: string[];
    /** Pairs a Sharp break on this tile would take with it: both halves in the clump and breakable. */
    pairsSharpWouldTake: number;
}

const canGoWithAChunk = (tile: Tile): boolean => tileCanBreakInChunk(tile) || tileIsChunkTreasure(tile);

export const getClumpRead = (board: Pick<BoardState, 'columns' | 'tiles'>, tileId: string): ClumpRead | null => {
    const seed = board.tiles.find((tile) => tile.id === tileId);
    // A flipped tile still stands in its clump: the break fires when its partner turns up, so
    // the read is worth more after the first flip, not less. Matched and removed tiles are gone.
    if (!seed || (seed.state !== 'hidden' && seed.state !== 'flipped') || !seed.suit) {
        return null;
    }
    const region = findSuitRegion(board, [tileId], Number.POSITIVE_INFINITY).map((index) => board.tiles[index]!);
    const clump = [seed, ...region];
    const inClump = new Set(clump.map((tile) => tile.id));
    const byPair = new Map<string, Tile[]>();
    for (const tile of board.tiles) {
        byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile]);
    }
    let pairsSharpWouldTake = 0;
    for (const [pairKey, halves] of byPair) {
        if (pairKey === seed.pairKey) continue;
        if (halves.length !== 2 || !halves.some((half) => inClump.has(half.id))) continue;
        if (halves.every(canGoWithAChunk)) pairsSharpWouldTake += 1;
    }
    return { suit: seed.suit, size: clump.length, tileIds: clump.map((tile) => tile.id), pairsSharpWouldTake };
};
