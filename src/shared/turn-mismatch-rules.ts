import { type BoardState, type RunState, type RunStatus, type Tile } from './contracts';
import { applyMagpieTheft, resolveMagpieVisit } from './magpie-rules';
import { hasMutator } from './mutators';
import { decreaseRecallFocus, rememberForgottenTiles } from './recall-rules';
import { clearResolveState } from './run-timer-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { calculateRating } from './scoring-rules';
import { addTileTraitCountStats, normalizeSessionStats } from './session-stats-rules';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { hideTileAfterTurn } from './tile-state-rules';
import { calculateTileTraitMismatchPenalty } from './tile-trait-rules';

/**
 * What a miss costs (thesis §34, §42.2, §67). No life, because there are no lives: a miss is a
 * try against the rating, a turn against the par, and the chain's momentum gone. A contract's
 * mismatch limit is the one miss that can end a run here; the turn ceiling is applied after the
 * turn, in `board-turn-transition.ts`, for a match and a miss alike.
 */
export interface MismatchPenalty {
    contractFail: boolean;
    status: RunStatus;
    tries: number;
}

export const createHiddenMismatchBoard = (
    board: BoardState,
    tileIds: readonly string[]
): BoardState => {
    const hiddenTileIds = new Set(tileIds);
    return {
        ...board,
        flippedTileIds: [],
        tiles: board.tiles.map((tile) => hiddenTileIds.has(tile.id) ? hideTileAfterTurn(tile) : tile)
    };
};

export const calculateMismatchPenalty = (run: RunState, triesDelta: number): MismatchPenalty => {
    const stats = normalizeSessionStats(run.stats);
    const tries = runNonNegativeInteger(stats.tries) + runNonNegativeInteger(triesDelta);
    const contractFail = run.activeContract?.maxMismatches != null && tries > run.activeContract.maxMismatches;
    return {
        contractFail,
        status: contractFail ? 'gameOver' : 'playing',
        tries
    };
};

export interface MismatchTurnTransitionInput {
    run: RunState;
    board: BoardState;
    tileIds: readonly string[];
    sourceTiles: readonly Tile[];
    triesDelta: number;
    decoyTouched: boolean;
}

export const resolveMismatchTurnTransition = ({
    run,
    board,
    tileIds,
    sourceTiles,
    triesDelta,
    decoyTouched
}: MismatchTurnTransitionInput): RunState => {
    const stats = normalizeSessionStats(run.stats);
    const normalizedRun = { ...run, stats };
    const traitPenalty = calculateTileTraitMismatchPenalty(normalizedRun, sourceTiles, board);
    const penalty = calculateMismatchPenalty(normalizedRun, triesDelta + traitPenalty.triesDelta);
    const hiddenBoard = createHiddenMismatchBoard(board, tileIds);
    const spunMiss = rotateRunShiftingSpotlight(run, hiddenBoard);

    /*
     * The magpie arrives last, after every other consequence of the miss has landed. It takes back
     * a pair the player already cleared rather than a point, so it has to act on the board the
     * turn actually produced — otherwise it would steal from a state the player never saw.
     */
    const magpie = hasMutator(run, 'magpie_thief')
        ? resolveMagpieVisit({
              board: spunMiss.board,
              mismatchCount: runNonNegativeInteger(stats.mismatches) + 1,
              rulesVersion: run.runRulesVersion,
              runSeed: run.runSeed
          })
        : null;
    const boardAfterMagpie =
        magpie?.theft != null ? applyMagpieTheft(spunMiss.board, magpie.theft) : spunMiss.board;

    return {
        ...run,
        status: penalty.status,
        runEndReason: penalty.contractFail ? 'contract' : run.runEndReason ?? null,
        board: boardAfterMagpie,
        shiftingSpotlightNonce: spunMiss.shiftingSpotlightNonce,
        magpieTheftsThisFloor:
            runNonNegativeInteger(run.magpieTheftsThisFloor) + (magpie?.kind === 'theft' ? 1 : 0),
        stickyBlockIndex: null,
        recallFocus: decreaseRecallFocus(run),
        recallMistakesThisFloor: runNonNegativeInteger(run.recallMistakesThisFloor) + 1,
        // A miss is a turn against the par as much as a match is; the gambit's three flips are one.
        turnsThisFloor: runNonNegativeInteger(run.turnsThisFloor) + 1,
        forgottenTileIdsThisFloor: rememberForgottenTiles(run.forgottenTileIdsThisFloor, tileIds),
        decoyFlippedThisFloor: run.decoyFlippedThisFloor || decoyTouched,
        // A miss keeps half the streak (the score multiplier forgives) but the cascade's momentum
        // is gone: the fire goes out, and the ladder is climbed again from what was remembered.
        chunkPairsThisChain: 0,
        stats: {
            ...stats,
            tries: penalty.tries,
            mismatches: runNonNegativeInteger(stats.mismatches) + 1,
            currentStreak: Math.floor(runNonNegativeInteger(stats.currentStreak) / 2),
            rating: calculateRating(penalty.tries),
            highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), runNonNegativeInteger(board.level)),
            tileTraitMismatches: addTileTraitCountStats(stats.tileTraitMismatches, sourceTiles)
        },
        timerState: clearResolveState(run)
    };
};
