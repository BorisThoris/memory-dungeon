import { MATCH_DELAY_MS, type BoardState, type RunState } from './contracts';
import { computeFlipResolveDelayMs, tilesArePairMatch } from './scoring-rules';
import { runFilteredStringArrayOrNull } from './run-array-guards';

interface FlipTileTransitionDeps {
    finalizeLevel: (run: RunState, board: BoardState) => RunState;
}

/*
 * A flip used to pass through the dungeon layer first: a roaming enemy cleared off the last pair,
 * an exit, vendor or room tile revealed instead of flipped, a trap sprung on the reveal. All of
 * that went with the dungeon modules (Gen 176). A flip is a flip: it turns one hidden tile face up
 * and, on the second, starts the resolve clock.
 */
export const createFlipTileTransition = (_deps: FlipTileTransitionDeps) =>
    (run: RunState, tileId: string): RunState => {
        if (!run.board) {
            return run;
        }
        const currentFlippedTileIdsBeforeFlash = runFilteredStringArrayOrNull(run.board.flippedTileIds);

        const gambitThirdWhileResolving =
            run.status === 'resolving' &&
            run.gambitAvailableThisFloor &&
            !run.gambitThirdFlipUsed &&
            currentFlippedTileIdsBeforeFlash?.length === 2;

        if (run.status !== 'playing' && !gambitThirdWhileResolving) {
            return run;
        }

        const runAfterFlashClear =
            (runFilteredStringArrayOrNull(run.flashPairRevealedTileIds)?.length ?? 0) > 0
                ? { ...run, flashPairRevealedTileIds: [] }
                : run;
        const board = runAfterFlashClear.board;
        if (!board) {
            return runAfterFlashClear;
        }
        const currentFlippedTileIds = runFilteredStringArrayOrNull(board.flippedTileIds);
        if (!currentFlippedTileIds) {
            return runAfterFlashClear;
        }

        const allowThird =
            runAfterFlashClear.gambitAvailableThisFloor &&
            !runAfterFlashClear.gambitThirdFlipUsed &&
            currentFlippedTileIds.length === 2;
        const maxFlips = allowThird ? 3 : 2;
        if (currentFlippedTileIds.length >= maxFlips) {
            return runAfterFlashClear;
        }

        const tile = board.tiles.find((candidate) => candidate.id === tileId);

        if (!tile || tile.state !== 'hidden' || currentFlippedTileIds.includes(tileId)) {
            return runAfterFlashClear;
        }

        const tileIndex = board.tiles.findIndex((candidate) => candidate.id === tileId);
        if (
            currentFlippedTileIds.length === 0 &&
            runAfterFlashClear.stickyBlockIndex !== null &&
            tileIndex === runAfterFlashClear.stickyBlockIndex
        ) {
            return runAfterFlashClear;
        }

        const peekRevealedTileIds =
            (runFilteredStringArrayOrNull(runAfterFlashClear.peekRevealedTileIds)?.length ?? 0) > 0
                ? ([] as string[])
                : runAfterFlashClear.peekRevealedTileIds;

        const flippedTileIds = [...currentFlippedTileIds, tileId];
        const firstFlippedId = currentFlippedTileIds[0] ?? null;
        const firstFlippedTile = firstFlippedId
            ? board.tiles.find((candidate) => candidate.id === firstFlippedId) ?? null
            : null;
        const resolvesMatchImmediately =
            flippedTileIds.length === 2 &&
            firstFlippedTile !== null &&
            tilesArePairMatch(firstFlippedTile, tile);

        let resolveRemainingMs = runAfterFlashClear.timerState.resolveRemainingMs;
        if (flippedTileIds.length === 2) {
            resolveRemainingMs = resolvesMatchImmediately
                ? 0
                : computeFlipResolveDelayMs(runAfterFlashClear, flippedTileIds, {
                      resolveDelayMultiplier: runAfterFlashClear.resolveDelayMultiplier,
                      echoFeedbackEnabled: runAfterFlashClear.echoFeedbackEnabled
                  });
        } else if (flippedTileIds.length === 3) {
            resolveRemainingMs = MATCH_DELAY_MS * runAfterFlashClear.resolveDelayMultiplier;
        }

        return {
            ...runAfterFlashClear,
            peekRevealedTileIds,
            status: flippedTileIds.length >= 2 ? 'resolving' : 'playing',
            board: {
                ...board,
                tiles: board.tiles.map((candidate) =>
                    candidate.id === tileId ? { ...candidate, state: 'flipped' } : candidate
                ),
                flippedTileIds
            },
            flipHistory: [...runAfterFlashClear.flipHistory, tileId],
            timerState: {
                ...runAfterFlashClear.timerState,
                resolveRemainingMs
            }
        };
    };
