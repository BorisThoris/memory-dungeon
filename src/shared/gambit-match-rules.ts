import { type BoardState } from './contracts';
import { tilesArePairMatch } from './scoring-rules';

export interface GambitMatchedPairSelection {
    firstTileId: string;
    secondTileId: string;
    thirdTileId: string;
}

export const selectGambitMatchedPair = (
    board: Pick<BoardState, 'flippedTileIds' | 'tiles'>
): GambitMatchedPairSelection | null => {
    if (!Array.isArray(board.flippedTileIds) || board.flippedTileIds.length !== 3) {
        return null;
    }
    const [aId, bId, cId] = board.flippedTileIds;
    const ta = board.tiles.find((tile) => tile.id === aId);
    const tb = board.tiles.find((tile) => tile.id === bId);
    const tc = board.tiles.find((tile) => tile.id === cId);
    if (!ta || !tb || !tc) {
        return null;
    }
    if (tilesArePairMatch(ta, tb)) {
        return { firstTileId: aId, secondTileId: bId, thirdTileId: cId };
    }
    if (tilesArePairMatch(ta, tc)) {
        return { firstTileId: aId, secondTileId: cId, thirdTileId: bId };
    }
    if (tilesArePairMatch(tb, tc)) {
        return { firstTileId: bId, secondTileId: cId, thirdTileId: aId };
    }
    return null;
};
