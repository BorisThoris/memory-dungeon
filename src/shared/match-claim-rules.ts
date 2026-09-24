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

/**
 * The card a wild joker stands in for: the other half of the real card it was matched with.
 *
 * A wild match counts one pair cleared, so the whole pair has to go. Until Gen 262 only the two
 * flipped cards were claimed, and the real card's partner stayed face down with nothing left to
 * pair it - the floor could never clear (the "Wild" option on the path screen softlocked on the
 * first joker played). `null` when neither card is the joker.
 */
export const wildStandInPartnerId = (board: BoardState, firstTileId: string, secondTileId: string): string | null => {
    const first = board.tiles.find((tile) => tile.id === firstTileId);
    const second = board.tiles.find((tile) => tile.id === secondTileId);
    if (!first || !second || isWildPairKey(first.pairKey) === isWildPairKey(second.pairKey)) return null;
    const real = isWildPairKey(first.pairKey) ? second : first;
    const partner = board.tiles.find(
        (tile) => tile.pairKey === real.pairKey && tile.id !== real.id && tile.state !== 'matched' && tile.state !== 'removed'
    );
    return partner?.id ?? null;
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
}): BoardState => {
    const standInFor = wildStandInPartnerId(board, firstTileId, secondTileId);
    return {
        ...board,
        flippedTileIds: [],
        matchedPairs: runNonNegativeInteger(board.matchedPairs) + 1,
        tiles: board.tiles.map((tile) => {
            if (tile.id === firstTileId || tile.id === secondTileId || tile.id === standInFor) {
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
    };
};
