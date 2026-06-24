import { MATCH_DELAY_MS, type BoardState, type RunState } from './contracts';
import { clearLastPairEnemyHazardSoftlock } from './dungeon-enemy-hazard-rules';
import { clearFinalPairEnemyHazardOccupationForRun } from './enemy-hazard-board-rules';
import { revealDungeonCardPair } from './dungeon-trap-rules';
import { revealDungeonRoom } from './dungeon-room-rules';
import { isBoardComplete } from './board-inspection';
import { EXIT_PAIR_KEY, ROOM_PAIR_KEY, SHOP_PAIR_KEY } from './tile-identity';
import { computeFlipResolveDelayMs, tilesArePairMatch } from './scoring-rules';
import { clearResolveState } from './run-timer-rules';
import { revealDungeonExit, revealDungeonShop } from './dungeon-reveal-rules';

interface FlipTileTransitionDeps {
    finalizeLevel: (run: RunState, board: BoardState) => RunState;
}

export const createFlipTileTransition = ({ finalizeLevel }: FlipTileTransitionDeps) =>
    (run: RunState, tileId: string): RunState => {
        const runAfterFinalPairCleanup = clearFinalPairEnemyHazardOccupationForRun(run);
        if (!runAfterFinalPairCleanup.board) {
            return run;
        }

        const gambitThirdWhileResolving =
            runAfterFinalPairCleanup.status === 'resolving' &&
            runAfterFinalPairCleanup.gambitAvailableThisFloor &&
            !runAfterFinalPairCleanup.gambitThirdFlipUsed &&
            runAfterFinalPairCleanup.board.flippedTileIds.length === 2;

        if (runAfterFinalPairCleanup.status !== 'playing' && !gambitThirdWhileResolving) {
            return runAfterFinalPairCleanup;
        }

        const runAfterFlashClear =
            runAfterFinalPairCleanup.flashPairRevealedTileIds.length > 0
                ? { ...runAfterFinalPairCleanup, flashPairRevealedTileIds: [] }
                : runAfterFinalPairCleanup;
        const boardBeforeLastPairFailsafe = runAfterFlashClear.board;
        if (!boardBeforeLastPairFailsafe) {
            return runAfterFlashClear;
        }
        const runAfterLastPairFailsafe = clearLastPairEnemyHazardSoftlock(runAfterFlashClear, boardBeforeLastPairFailsafe);
        const board = runAfterLastPairFailsafe.board;
        if (!board) {
            return runAfterLastPairFailsafe;
        }

        const allowThird =
            runAfterLastPairFailsafe.gambitAvailableThisFloor &&
            !runAfterLastPairFailsafe.gambitThirdFlipUsed &&
            board.flippedTileIds.length === 2;
        const maxFlips = allowThird ? 3 : 2;
        if (board.flippedTileIds.length >= maxFlips) {
            return runAfterLastPairFailsafe;
        }

        const tile = board.tiles.find((candidate) => candidate.id === tileId);

        if (!tile || tile.state !== 'hidden' || board.flippedTileIds.includes(tileId)) {
            return runAfterLastPairFailsafe;
        }

        const tileIndex = board.tiles.findIndex((candidate) => candidate.id === tileId);
        if (
            board.flippedTileIds.length === 0 &&
            runAfterLastPairFailsafe.stickyBlockIndex !== null &&
            tileIndex === runAfterLastPairFailsafe.stickyBlockIndex
        ) {
            return runAfterLastPairFailsafe;
        }

        if (tile.pairKey === EXIT_PAIR_KEY) {
            return revealDungeonExit(runAfterLastPairFailsafe, tileId);
        }
        if (tile.pairKey === SHOP_PAIR_KEY) {
            return revealDungeonShop(runAfterLastPairFailsafe, tileId);
        }
        if (tile.pairKey === ROOM_PAIR_KEY) {
            return revealDungeonRoom(runAfterLastPairFailsafe, tileId);
        }

        const runAfterDungeonReveal =
            tile.state === 'hidden' ? revealDungeonCardPair(runAfterLastPairFailsafe, tile) : runAfterLastPairFailsafe;
        if (runAfterDungeonReveal.status === 'gameOver') {
            return runAfterDungeonReveal;
        }
        const revealedBoard = runAfterDungeonReveal.board;
        if (!revealedBoard) {
            return runAfterDungeonReveal;
        }
        const peekRevealedTileIds =
            runAfterDungeonReveal.peekRevealedTileIds.length > 0 ? ([] as string[]) : runAfterDungeonReveal.peekRevealedTileIds;
        if (
            tile.state === 'hidden' &&
            tile.dungeonCardKind === 'trap' &&
            runAfterDungeonReveal.dungeonTrapsTriggered > runAfterLastPairFailsafe.dungeonTrapsTriggered
        ) {
            const trapResolvedRun: RunState = {
                ...runAfterDungeonReveal,
                status: 'playing',
                peekRevealedTileIds,
                board: {
                    ...revealedBoard,
                    flippedTileIds: []
                },
                flipHistory: [...runAfterDungeonReveal.flipHistory, tileId],
                timerState: clearResolveState(runAfterDungeonReveal)
            };
            return trapResolvedRun.board && isBoardComplete(trapResolvedRun.board)
                ? finalizeLevel(trapResolvedRun, trapResolvedRun.board)
                : trapResolvedRun;
        }

        const flippedTileIds = [...revealedBoard.flippedTileIds, tileId];
        const firstFlippedId = revealedBoard.flippedTileIds[0] ?? null;
        const firstFlippedTile = firstFlippedId
            ? revealedBoard.tiles.find((candidate) => candidate.id === firstFlippedId) ?? null
            : null;
        const revealedTile = revealedBoard.tiles.find((candidate) => candidate.id === tileId) ?? tile;
        const resolvesMatchImmediately =
            flippedTileIds.length === 2 &&
            firstFlippedTile !== null &&
            tilesArePairMatch(firstFlippedTile, revealedTile);

        let resolveRemainingMs = runAfterDungeonReveal.timerState.resolveRemainingMs;
        if (flippedTileIds.length === 2) {
            resolveRemainingMs = resolvesMatchImmediately
                ? 0
                : computeFlipResolveDelayMs(runAfterDungeonReveal, flippedTileIds, {
                      resolveDelayMultiplier: runAfterDungeonReveal.resolveDelayMultiplier,
                      echoFeedbackEnabled: runAfterDungeonReveal.echoFeedbackEnabled
                  });
        } else if (flippedTileIds.length === 3) {
            resolveRemainingMs = MATCH_DELAY_MS * runAfterDungeonReveal.resolveDelayMultiplier;
        }

        return {
            ...runAfterDungeonReveal,
            peekRevealedTileIds,
            status: flippedTileIds.length >= 2 ? 'resolving' : 'playing',
            board: {
                ...revealedBoard,
                tiles: revealedBoard.tiles.map((candidate) =>
                    candidate.id === tileId ? { ...candidate, state: 'flipped' } : candidate
                ),
                flippedTileIds
            },
            flipHistory: [...runAfterDungeonReveal.flipHistory, tileId],
            timerState: {
                ...runAfterDungeonReveal.timerState,
                resolveRemainingMs
            }
        };
    };
