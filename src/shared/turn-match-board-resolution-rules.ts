import type { BoardState, RunState } from './contracts';
import { createMatchedPairClaimBoard } from './match-claim-rules';
import { chainMomentum, runChainMomentumPairs, runLadderChain } from './chain-tier-rules';
import { resolveChunkBreak, type ChunkBreakResult } from './chunk-break-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { elementPopSpec } from './element-resonance-rules';
import { swaySuitOf } from './realm-sway-rules';

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
    // On a realm floor the pop is the reaction's: nothing pops unless this match reacts with the
    // streak in hand, and then it pops by the reaction's potency (`elementPopSpec`).
    // The joker has no element: a pair it completes is no reaction, and bursts nothing.
    const firstMatched = board.tiles.find((tile) => tile.id === firstTileId);
    const secondMatched = board.tiles.find((tile) => tile.id === secondTileId);
    const matchedSuit = firstMatched && secondMatched && firstMatched.pairKey === secondMatched.pairKey ? swaySuitOf(firstMatched) : null;
    const chunkBreak = resolveChunkBreak({
        board: claimedBoard,
        run,
        matchedTileIds: [firstTileId, secondTileId],
        chain: chainMomentum(runLadderChain({ ...run, stats: normalizeSessionStats(run.stats) }) + 1, runChainMomentumPairs(run)),
        spec: elementPopSpec(run, matchedSuit)
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
