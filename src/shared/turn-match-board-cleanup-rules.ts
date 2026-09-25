import type { BoardState, RunState } from './contracts';
import { countFullyHiddenPairs } from './board-inspection';
import { hasMutator } from './mutators';
import { increaseRecallFocus, settleForgottenTiles } from './recall-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';

export interface TurnMatchBoardCleanupResult {
    pinnedTileIds: string[];
    recallFocus: number;
    recallMatchesThisFloor: number;
    recallBonusScoreThisFloor: number;
    forgottenTileIdsThisFloor: string[];
}

export interface TurnMatchBoardCleanupInput {
    run: RunState;
    matchedTileIds: readonly string[];
    recallBonus: number;
}

export const resolveTurnMatchBoardCleanup = ({
    run,
    matchedTileIds,
    recallBonus
}: TurnMatchBoardCleanupInput): TurnMatchBoardCleanupResult => {
    const matched = new Set(matchedTileIds);

    return {
        pinnedTileIds: run.pinnedTileIds.filter((id) => !matched.has(id)),
        recallFocus: increaseRecallFocus(run),
        recallMatchesThisFloor: runNonNegativeInteger(run.recallMatchesThisFloor) + 1,
        recallBonusScoreThisFloor: runNonNegativeInteger(run.recallBonusScoreThisFloor) + runNonNegativeInteger(recallBonus),
        forgottenTileIdsThisFloor: settleForgottenTiles(run.forgottenTileIdsThisFloor, matchedTileIds)
    };
};

/**
 * Sticky fingers: after a match, a face-down card touching the first card of the pair sticks, and
 * the next turn cannot open on it (it can still be the second card - `flip-tile-transition.ts`).
 *
 * Until the test hall walked it, this blocked the slot of the first matched card itself. That card
 * had just been matched, and a matched card cannot be opened anyway, so the block refused nothing:
 * the mutator scheduled on every seventh floor did nothing a player could feel, while its Codex
 * entry promised a reserved slot. It is chosen on the board the player will look at - after the
 * pop and any drift - so the stuck card is still face down when the next turn starts; the lowest
 * index wins, so a replay sticks the same card. Nothing sticks with one pair left, the line the
 * Stasis lock holds too (`releaseStrandedStasisBlock`).
 */
export const selectStickyFingersBlockIndex = (
    run: RunState,
    board: BoardState,
    firstMatchedTileId: string
): number | null => {
    if (!hasMutator(run, 'sticky_fingers') || countFullyHiddenPairs(board) <= 1) {
        return null;
    }
    const from = board.tiles.findIndex((tile) => tile.id === firstMatchedTileId);
    if (from < 0) {
        return null;
    }
    const neighbours = orthogonalNeighbourIndices(from, board.columns, board.tiles.length)
        .filter((index) => board.tiles[index]?.state === 'hidden')
        .sort((a, b) => a - b);
    return neighbours[0] ?? null;
};

/**
 * A simulated player who sees a lock turns the locked card second, as a person would: the pair is
 * ordered so the locked tile never opens the turn. Used by the census, the curve and the audits.
 */
export const orderAroundLock = <T extends { id: string }>(
    run: Pick<RunState, 'board' | 'stickyBlockIndex'>,
    first: T,
    second: T
): [T, T] => {
    const locked = run.stickyBlockIndex != null ? run.board?.tiles[run.stickyBlockIndex]?.id : undefined;
    return locked != null && locked === first.id ? [second, first] : [first, second];
};
