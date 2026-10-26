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
export const wildStandInPartnerId = (board: BoardState, firstTileId: string, secondTileId: string): string | null =>
    wildStandInPartnerIds(board, firstTileId, secondTileId)[0] ?? null;

/** Every card the joker stands in for: on a Triples floor's three (`match-rule-rules.ts`), both the real card's others. */
const wildStandInPartnerIds = (board: BoardState, firstTileId: string, secondTileId: string): string[] => {
    const first = board.tiles.find((tile) => tile.id === firstTileId);
    const second = board.tiles.find((tile) => tile.id === secondTileId);
    if (!first || !second || isWildPairKey(first.pairKey) === isWildPairKey(second.pairKey)) return [];
    const real = isWildPairKey(first.pairKey) ? second : first;
    return board.tiles
        .filter((tile) => tile.pairKey === real.pairKey && tile.id !== real.id && tile.state !== 'matched' && tile.state !== 'removed')
        .map((tile) => tile.id);
};

export const createMatchedPairClaimBoard = ({
    board,
    firstTileId,
    secondTileId,
    thirdTileId,
    claimThird = false
}: {
    board: BoardState;
    firstTileId: string;
    secondTileId: string;
    thirdTileId?: string;
    /** Triples (`match-rule-rules.ts`): the third card is the three's third, claimed with the other two. */
    claimThird?: boolean;
}): BoardState => {
    const standInFor = wildStandInPartnerIds(board, firstTileId, secondTileId);
    const claimed = new Set([firstTileId, secondTileId, ...standInFor, ...(claimThird && thirdTileId != null ? [thirdTileId] : [])]);
    return {
        ...board,
        flippedTileIds: [],
        matchedPairs: runNonNegativeInteger(board.matchedPairs) + 1,
        tiles: board.tiles.map((tile) => {
            if (claimed.has(tile.id)) {
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
