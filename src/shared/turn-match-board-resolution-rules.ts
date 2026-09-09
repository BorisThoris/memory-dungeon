import type { BoardState, RunState } from './contracts';
import { createMatchedPairClaimBoard } from './match-claim-rules';
import { chainMomentum } from './chain-tier-rules';
import { resolveChunkBreak, type ChunkBreakResult } from './chunk-break-rules';
import { normalizeSessionStats } from './session-stats-rules';

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
     * A cleared card leaves a hole where it stood, and the hole stays. Gen 192 took out the settle
     * that used to close it: a card the player had placed is not moved, whatever it costs the
     * cascade. `docs/REMOVED_SETTLE.md`.
     */
    return {
        board: chunkBreak.board,
        chunkBreak
    };
};
