import { type BoardState } from './contracts';
import { tilesArePairMatch } from './scoring-rules';

export interface GambitMatchedPairSelection {
    firstTileId: string;
    secondTileId: string;
    thirdTileId: string;
}

export const selectGambitMatchedPair = (
    board: Pick<BoardState, 'flippedTileIds' | 'tiles' | 'tripleKeys'>
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
    // Two of a Triples floor's three are never a pair on their own (`match-rule-rules.ts`): the three goes whole.
    const pair = (x: typeof ta, y: typeof ta) => tilesArePairMatch(x, y) && !(board.tripleKeys ?? []).includes(x.pairKey) && !(board.tripleKeys ?? []).includes(y.pairKey);
    if (pair(ta, tb)) {
        return { firstTileId: aId, secondTileId: bId, thirdTileId: cId };
    }
    if (pair(ta, tc)) {
        return { firstTileId: aId, secondTileId: cId, thirdTileId: bId };
    }
    if (pair(tb, tc)) {
        return { firstTileId: bId, secondTileId: cId, thirdTileId: aId };
    }
    return null;
};
