import type { BoardState, Tile } from './contracts';
import { DECOY_PAIR_KEY } from './tile-identity';
import { tilesArePairMatch } from './turn-resolution';

const indexToPos = (board: BoardState, index: number): { col: number; row: number } => ({
    row: Math.floor(index / board.columns),
    col: index % board.columns
});

const manhattan = (a: { col: number; row: number }, b: { col: number; row: number }): number =>
    Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

/** Partner tile still on the board in a state that can participate in a match. */
const isPartnerCandidate = (t: Tile): boolean => t.state === 'hidden' || t.state === 'flipped';

/**
 * Manhattan grid distance from this flipped tile to the nearest tile that could legally match it.
 * Returns `null` for hidden tiles, decoys, or when no candidate exists.
 */
export const getPairProximityGridDistance = (board: BoardState, tileId: string): number | null => {
    const selfIndex = board.tiles.findIndex((t) => t.id === tileId);
    if (selfIndex < 0) {
        return null;
    }
    const tile = board.tiles[selfIndex];
    if (!tile) {
        return null;
    }
    if (tile.state !== 'flipped') {
        return null;
    }
    if (tile.pairKey === DECOY_PAIR_KEY) {
        return null;
    }

    const selfPos = indexToPos(board, selfIndex);

    const candidates = board.tiles.filter((c, i) => {
        if (i === selfIndex) {
            return false;
        }
        if (!isPartnerCandidate(c)) {
            return false;
        }
        return tilesArePairMatch(tile, c);
    });

    if (candidates.length === 0) {
        return null;
    }

    let best = Infinity;
    for (const c of candidates) {
        const ci = board.tiles.findIndex((t) => t.id === c.id);
        if (ci < 0) {
            continue;
        }
        const d = manhattan(selfPos, indexToPos(board, ci));
        if (d < best) {
            best = d;
        }
    }
    return best === Infinity ? null : best;
};
