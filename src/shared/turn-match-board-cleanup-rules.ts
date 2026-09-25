import type { BoardState, RunState } from './contracts';
import { increaseRecallFocus, settleForgottenTiles } from './recall-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

export interface TurnMatchBoardCleanupResult {
    pinnedTileIds: string[];
    recallFocus: number;
    recallMatchesThisFloor: number;
    recallBonusScoreThisFloor: number;
    forgottenTileIdsThisFloor: string[];
}

export interface TurnMatchBoardCleanupInput {
    run: RunState;
    board: BoardState;
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
 * The two cards of a planned turn in the order a player who can see the lock turns them: the
 * locked card second. Reference players (the sims, the census, the soak) pick two cards and flip
 * them in list order; opening on a locked card is refused, the second press becomes the opener and
 * the turn never resolves - a wasted turn no player would take, which read as sticky fingers
 * costing a perfect player a turn and a half on floor 19. A lock never blocks the second card.
 */
export const orderAroundLock = <T extends { id: string }>(
    run: Pick<RunState, 'board' | 'stickyBlockIndex'>,
    first: T,
    second: T
): [T, T] => {
    const locked = run.stickyBlockIndex != null ? run.board?.tiles[run.stickyBlockIndex]?.id : undefined;
    return locked != null && locked === first.id ? [second, first] : [first, second];
};

/**
 * Sticky fingers: after a match, the board slot the next turn may not open on.
 *
 * The rule the Codex states is "one board slot is reserved so your next opening flip must start
 * elsewhere". It used to reserve the slot of the first matched card - a card that had just been
 * matched and so could never be opened anyway. Played to floor 7 and probed, the Trap Hall's lock
 * landed on a turnable card exactly as often with the mutator as without it (every hit was a
 * Stasis trait's): the floor's boss mechanic did nothing at all, while the mutator audit counted a
 * non-null index as an effect.
 *
 * So the lock goes where the hand still is: the first face-down card touching the matched pair on
 * the board the turn produced (after the pop and any drift), in board order so a replay locks the
 * same card. No lock when nothing face down touches the pair, and none when one hidden pair is left
 * - a lock on the floor's last pair would leave nothing to open with.
 */
export const selectStickyFingersLockIndex = (
    board: Pick<BoardState, 'columns' | 'tiles'>,
    matchedTileIds: readonly string[]
): number | null => {
    const playable = (index: number): boolean => {
        const tile = board.tiles[index];
        return tile != null && tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey);
    };
    const hiddenPairKeys = new Set<string>();
    const seen = new Set<string>();
    for (let index = 0; index < board.tiles.length; index += 1) {
        const tile = board.tiles[index]!;
        if (!playable(index)) continue;
        if (seen.has(tile.pairKey)) hiddenPairKeys.add(tile.pairKey);
        seen.add(tile.pairKey);
    }
    if (hiddenPairKeys.size <= 1) {
        return null;
    }
    const candidates = new Set<number>();
    for (const id of matchedTileIds) {
        const index = board.tiles.findIndex((tile) => tile.id === id);
        if (index < 0) continue;
        for (const neighbour of orthogonalNeighbourIndices(index, board.columns, board.tiles.length)) {
            if (playable(neighbour)) candidates.add(neighbour);
        }
    }
    return candidates.size > 0 ? Math.min(...candidates) : null;
};
