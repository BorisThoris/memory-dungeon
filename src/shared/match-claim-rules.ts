import {
    FINDABLE_MATCH_SCORE,
    type BoardState,
    type FindableKind,
    type Tile
} from './contracts';
import { runNonNegativeInteger } from './run-number-guards';
import { hideTileAfterTurn } from './tile-state-rules';
import { isWildPairKey } from './tile-identity';

export interface MatchClaimContext {
    claimedFindableKind: FindableKind | null;
    findableScoreBonus: number;
    findablesClaimedDelta: number;
    matchedPairKey: string;
    usedWild: boolean;
}

/** What a matched pair claims: the findable riding on it, if any, and which pair key it counts as. */
export const deriveMatchClaimContext = (firstTile: Tile, secondTile: Tile): MatchClaimContext => {
    const claimedFindableKind = firstTile.findableKind ?? secondTile.findableKind ?? null;
    const matchedPairKey = isWildPairKey(firstTile.pairKey) ? secondTile.pairKey : firstTile.pairKey;

    return {
        claimedFindableKind,
        findableScoreBonus: claimedFindableKind != null ? FINDABLE_MATCH_SCORE[claimedFindableKind] : 0,
        findablesClaimedDelta: claimedFindableKind != null ? 1 : 0,
        matchedPairKey,
        usedWild: isWildPairKey(firstTile.pairKey) || isWildPairKey(secondTile.pairKey)
    };
};

export const createMatchedPairClaimBoard = ({
    board,
    firstTileId,
    secondTileId,
    thirdTileId
}: {
    board: BoardState;
    firstTileId: string;
    secondTileId: string;
    thirdTileId?: string;
}): BoardState => ({
    ...board,
    flippedTileIds: [],
    matchedPairs: runNonNegativeInteger(board.matchedPairs) + 1,
    tiles: board.tiles.map((tile) => {
        if (tile.id === firstTileId || tile.id === secondTileId) {
            return {
                ...tile,
                state: 'matched' as const,
                findableKind: undefined
            };
        }
        if (thirdTileId != null && tile.id === thirdTileId) {
            return hideTileAfterTurn(tile);
        }
        return tile;
    })
});
