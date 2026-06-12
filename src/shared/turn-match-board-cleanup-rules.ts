import type { BoardState, RunState } from './contracts';
import { hasMutator } from './mutators';
import { increaseRecallFocus, settleForgottenTiles } from './recall-rules';

export interface TurnMatchBoardCleanupResult {
    pinnedTileIds: string[];
    recallFocus: number;
    recallMatchesThisFloor: number;
    recallBonusScoreThisFloor: number;
    forgottenTileIdsThisFloor: string[];
    stickyBlockIndex: number | null;
}

export interface TurnMatchBoardCleanupInput {
    run: RunState;
    board: BoardState;
    matchedTileIds: readonly string[];
    firstMatchedTileId: string;
    recallBonus: number;
}

export const resolveTurnMatchBoardCleanup = ({
    run,
    board,
    matchedTileIds,
    firstMatchedTileId,
    recallBonus
}: TurnMatchBoardCleanupInput): TurnMatchBoardCleanupResult => {
    const matched = new Set(matchedTileIds);

    return {
        pinnedTileIds: run.pinnedTileIds.filter((id) => !matched.has(id)),
        recallFocus: increaseRecallFocus(run),
        recallMatchesThisFloor: run.recallMatchesThisFloor + 1,
        recallBonusScoreThisFloor: run.recallBonusScoreThisFloor + recallBonus,
        forgottenTileIdsThisFloor: settleForgottenTiles(run.forgottenTileIdsThisFloor, matchedTileIds),
        stickyBlockIndex: hasMutator(run, 'sticky_fingers')
            ? board.tiles.findIndex((tile) => tile.id === firstMatchedTileId)
            : null
    };
};
