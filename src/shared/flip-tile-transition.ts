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

        /*
         * Every refusal below hands back the run it was given, untouched. The clears of what a flash
         * and the lantern lit used to happen first, so a refused press - the open card tapped again,
         * the sticky-blocked card, a third card with no Gambit - still returned a new run: the lit
         * faces went dark with no turn taken, and the store, reading any new run as a flip, disarmed
         * whatever mode the player had armed.
         */
        const board = run.board;
        const currentFlippedTileIds = currentFlippedTileIdsBeforeFlash;
        if (!currentFlippedTileIds) {
            return run;
        }

        const allowThird =
            run.gambitAvailableThisFloor &&
            !run.gambitThirdFlipUsed &&
            currentFlippedTileIds.length === 2;
        const maxFlips = allowThird ? 3 : 2;
        if (currentFlippedTileIds.length >= maxFlips) {
            return run;
        }

        const tile = board.tiles.find((candidate) => candidate.id === tileId);

        // A frozen card (the cold world, `world-reaction-rules.ts`) cannot be turned until it thaws.
        if (!tile || tile.state !== 'hidden' || tile.frozen === true || currentFlippedTileIds.includes(tileId)) {
            return run;
        }

        const tileIndex = board.tiles.findIndex((candidate) => candidate.id === tileId);
        if (
            currentFlippedTileIds.length === 0 &&
            run.stickyBlockIndex !== null &&
            tileIndex === run.stickyBlockIndex
        ) {
            return run;
        }

        const flashCleared =
            (runFilteredStringArrayOrNull(run.flashPairRevealedTileIds)?.length ?? 0) > 0
                ? { ...run, flashPairRevealedTileIds: [] }
                : run;
        // What the lantern lit goes dark the moment the next card is turned, the same way a flash does.
        const runAfterFlashClear =
            (runFilteredStringArrayOrNull(flashCleared.lanternLitTileIds)?.length ?? 0) > 0
                ? { ...flashCleared, lanternLitTileIds: [] }
                : flashCleared;

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
