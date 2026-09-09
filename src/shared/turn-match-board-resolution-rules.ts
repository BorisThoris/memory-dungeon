import type { BoardState, RunState } from './contracts';
import { createMatchedPairClaimBoard } from './match-claim-rules';
import { chainMomentum } from './chain-tier-rules';
import { resolveChunkBreak, type ChunkBreakResult } from './chunk-break-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { settleBoardTowardCentre } from './board-settle-rules';

export interface TurnMatchBoardResolutionResult {
    board: BoardState;
    chunkBreak: ChunkBreakResult;
}

export interface TurnMatchBoardResolutionInput {
    run: RunState;
    board: BoardState;
    firstTileId: string;
    secondTileId: string;
    thirdTileId?: string;
}

/** The board after a match: the pair claimed, the gambit third tile hidden again, and the chunk break run. */
export const resolveTurnMatchBoardResolution = ({
    run,
    board,
    firstTileId,
    secondTileId,
    thirdTileId
}: TurnMatchBoardResolutionInput): TurnMatchBoardResolutionResult => {
    const claimedBoard = createMatchedPairClaimBoard({
        board,
        firstTileId,
        secondTileId,
        thirdTileId
    });
    // The chain this match completes is the chain that buys the break: the streak the run holds
    // plus this match.
    const chunkBreak = resolveChunkBreak({
        board: claimedBoard,
        run,
        matchedTileIds: [firstTileId, secondTileId],
        chain: chainMomentum(normalizeSessionStats(run.stats).currentStreak + 1, run.chunkPairsThisChain)
    });

    /*
     * The settle. Whatever the match and the break took is gone, and the cards that are left fall
     * toward the middle to close the gap - so the next turn's reach, ripple and aim guide read a
     * board that is still packed rather than one slowly going hollow.
     */
    return {
        board: settleBoardTowardCentre(chunkBreak.board),
        chunkBreak
    };
};
