import { type RunState } from './contracts';
import { selectGambitMatchedPair } from './gambit-match-rules';

export interface MatchFloaterAnchorTileIds {
    tileIdA: string;
    tileIdB: string;
}

export interface MismatchFloaterAnchorTileIds {
    tileIdA: string;
    tileIdB: string;
    tileIdC?: string;
}

/**
 * CARD-008: Tile ids for match-score board floater (two-flip or gambit matched pair).
 * Mirrors gambit pairing and renderer `tileResolvingSelection.gambitMatchPairIds`.
 * Returns null when three tiles are flipped but none form a pair.
 */
export const getMatchFloaterAnchorTileIds = (
    run: RunState | null
): MatchFloaterAnchorTileIds | null => {
    const board = run?.board;
    if (!board) {
        return null;
    }
    const ids = board.flippedTileIds;
    if (ids.length === 2) {
        return { tileIdA: ids[0], tileIdB: ids[1] };
    }
    if (ids.length !== 3) {
        return null;
    }
    const selection = selectGambitMatchedPair(board);
    return selection
        ? { tileIdA: selection.firstTileId, tileIdB: selection.secondTileId }
        : null;
};

/**
 * Tile ids for mismatch floater: flipped pair order for two-flip miss; three ids for gambit miss.
 */
export const getMismatchFloaterAnchorTileIds = (
    run: RunState | null
): MismatchFloaterAnchorTileIds | null => {
    const board = run?.board;
    if (!board) {
        return null;
    }
    const ids = board.flippedTileIds;
    if (ids.length === 2) {
        return { tileIdA: ids[0], tileIdB: ids[1] };
    }
    if (ids.length === 3) {
        return { tileIdA: ids[0], tileIdB: ids[1], tileIdC: ids[2] };
    }
    return null;
};
