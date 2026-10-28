import { dropMask, unmaskOnFlip } from './mask-rules';
import { hasEvolution } from './relic-evolution-rules';
import { MATCH_DELAY_MS, type BoardState, type RunState } from './contracts';
import { computeFlipResolveDelayMs, tilesArePairMatch } from './scoring-rules';
import { runFilteredStringArrayOrNull } from './run-array-guards';
import { isTileFlipBlocked, shedSnow } from './realm-weather-rules';
import { isTripleKey, pendingTripleKey, tilesMatchOnBoard } from './match-rule-rules';
import { crawlBlocksFirstFlip } from './crawl-rules';

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

        // Two of a three up (`match-rule-rules.ts`): the turn goes on to its third card.
        const tripleWaiting = pendingTripleKey(board) != null;
        const allowThird =
            tripleWaiting ||
            (run.gambitAvailableThisFloor &&
                !run.gambitThirdFlipUsed &&
                currentFlippedTileIds.length === 2);
        const maxFlips = allowThird ? 3 : 2;
        if (currentFlippedTileIds.length >= maxFlips) {
            return run;
        }

        const tile = board.tiles.find((candidate) => candidate.id === tileId);

        if (!tile || tile.state !== 'hidden' || currentFlippedTileIds.includes(tileId)) {
            return run;
        }
        // Frozen and vined cards cannot be turned (`realm-weather-rules.ts`).
        if (isTileFlipBlocked(tile)) {
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
        // The crawl (`crawl-rules.ts`): a turn's first card is turned on the hero's ground or beside it.
        if (currentFlippedTileIds.length === 0 && crawlBlocksFirstFlip(board, tileIndex, run.stickyBlockIndex)) {
            return run;
        }

        const flashCleared =
            (runFilteredStringArrayOrNull(run.flashPairRevealedTileIds)?.length ?? 0) > 0
                ? { ...run, flashPairRevealedTileIds: [] }
                : run;
        // What the lantern lit goes dark the moment the next card is turned, the same way a flash does.
        // Lantern of Recall keeps its light for the floor (`relic-evolution-rules.ts`).
        const lanternCleared =
            (runFilteredStringArrayOrNull(flashCleared.lanternLitTileIds)?.length ?? 0) > 0 && !hasEvolution(flashCleared, 'lantern_of_recall')
                ? { ...flashCleared, lanternLitTileIds: [] }
                : flashCleared;
        // What lightning lit goes dark the same way (`realm-weather-rules.ts`).
        const runAfterFlashClear =
            (runFilteredStringArrayOrNull(lanternCleared.realmLitTileIds)?.length ?? 0) > 0
                ? { ...lanternCleared, realmLitTileIds: [] }
                : lanternCleared;

        const peekRevealedTileIds =
            (runFilteredStringArrayOrNull(runAfterFlashClear.peekRevealedTileIds)?.length ?? 0) > 0
                ? ([] as string[])
                : runAfterFlashClear.peekRevealedTileIds;

        const flippedTileIds = [...currentFlippedTileIds, tileId];
        const firstFlippedId = currentFlippedTileIds[0] ?? null;
        const firstFlippedTile = firstFlippedId
            ? board.tiles.find((candidate) => candidate.id === firstFlippedId) ?? null
            : null;
        // Triples: two of a three wait for the third, face up; the third card resolves at once whatever it is.
        // Sequences: only a one then a two wait; two of a three out of order are a miss.
        const opensThree = flippedTileIds.length === 2 && pendingTripleKey({ ...board, flippedTileIds }) != null;
        const resolvesMatchImmediately =
            flippedTileIds.length === 2 &&
            !opensThree &&
            !isTripleKey(board, tile.pairKey) &&
            firstFlippedTile !== null &&
            // Element pairs (`match-rule-rules.ts`): two plain cards of one element are a pair on that floor.
            tilesMatchOnBoard(board, firstFlippedTile, tile, tilesArePairMatch);

        let resolveRemainingMs = runAfterFlashClear.timerState.resolveRemainingMs;
        if (opensThree) {
            resolveRemainingMs = 0;
        } else if (flippedTileIds.length === 3 && tripleWaiting) {
            resolveRemainingMs = tilesArePairMatch(firstFlippedTile!, tile) ? 0 : MATCH_DELAY_MS * runAfterFlashClear.resolveDelayMultiplier;
        } else if (flippedTileIds.length === 2) {
            resolveRemainingMs = resolvesMatchImmediately
                ? 0
                : computeFlipResolveDelayMs(runAfterFlashClear, flippedTileIds, {
                      resolveDelayMultiplier: runAfterFlashClear.resolveDelayMultiplier,
                      echoFeedbackEnabled: runAfterFlashClear.echoFeedbackEnabled
                  });
        } else if (flippedTileIds.length === 3) {
            resolveRemainingMs = MATCH_DELAY_MS * runAfterFlashClear.resolveDelayMultiplier;
        }

        // The first flip of a masked card drops its mask (`mask-rules.ts`), and the floor counts it.
        const turned = board.tiles.find((candidate) => candidate.id === tileId);
        return {
            ...(turned ? unmaskOnFlip(runAfterFlashClear, turned) : runAfterFlashClear),
            peekRevealedTileIds,
            status: flippedTileIds.length >= 2 && !opensThree ? 'resolving' : 'playing',
            board: {
                ...board,
                tiles: board.tiles.map((candidate) =>
                    candidate.id === tileId ? { ...dropMask(shedSnow(candidate)), state: 'flipped' } : candidate
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
