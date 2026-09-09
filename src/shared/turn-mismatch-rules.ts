import { type BoardState, type RunState, type RunStatus, type Tile } from './contracts';
import { applyMagpieTheft, resolveMagpieVisit } from './magpie-rules';
import { hasMutator } from './mutators';
import { hasFirstMismatchGrace } from './mismatch-grace-rules';
import {
    addPendingMemorizeBonusForLostLives,
    decreaseRecallFocus,
    rememberForgottenTiles
} from './recall-rules';
import {
    clearResolveState
} from './run-timer-rules';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import { calculateRating } from './scoring-rules';
import { addTileTraitCountStats, normalizeSessionStats } from './session-stats-rules';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { hideTileAfterTurn } from './tile-state-rules';
import { calculateTileTraitMismatchPenalty } from './tile-trait-rules';

export interface MismatchPenalty {
    consumesGuardToken: boolean;
    contractFail: boolean;
    guardTokens: number;
    hasGraceMismatch: boolean;
    lives: number;
    lostLife: boolean;
    pendingMemorizeBonusMs: number;
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

export const calculateMismatchPenalty = (
    run: RunState,
    board: BoardState,
    triesDelta: number
): MismatchPenalty => {
    const stats = normalizeSessionStats(run.stats);
    const safeTries = runNonNegativeInteger(stats.tries);
    const safeTriesDelta = runNonNegativeInteger(triesDelta);
    const safeGuardTokens = runNonNegativeInteger(stats.guardTokens);
    const safeLives = runNonNegativeInteger(run.lives);
    const tries = safeTries + safeTriesDelta;
    const hasGraceMismatch = hasFirstMismatchGrace(
        { ...run, lives: safeLives, stats: { ...stats, guardTokens: safeGuardTokens, tries: safeTries } },
        board
    );
    const consumesGuardToken = !hasGraceMismatch && safeGuardTokens > 0;
    const lostLife = !hasGraceMismatch && !consumesGuardToken;
    const contractFail = run.activeContract?.maxMismatches != null && tries > run.activeContract.maxMismatches;
    const lives = contractFail ? 0 : lostLife ? safeLives - 1 : safeLives;
    const status: RunStatus = lives <= 0 || contractFail ? 'gameOver' : 'playing';
    const guardTokens = consumesGuardToken ? decrementRunCounter(safeGuardTokens) : safeGuardTokens;

    return {
        consumesGuardToken,
        contractFail,
        guardTokens,
        hasGraceMismatch,
        lives,
        lostLife,
        pendingMemorizeBonusMs: addPendingMemorizeBonusForLostLives(run.pendingMemorizeBonusMs, lostLife ? 1 : 0),
        status,
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
    const penalty = calculateMismatchPenalty(normalizedRun, board, triesDelta + traitPenalty.triesDelta);
    const hiddenBoard = createHiddenMismatchBoard(board, tileIds);
    const spunMiss = rotateRunShiftingSpotlight(run, hiddenBoard);

    /*
     * The magpie arrives last, after every other consequence of the miss has landed. It takes back
     * a pair the player already cleared rather than a life or a point, so it has to act on the
     * board the turn actually produced — otherwise it would steal from a state the player never saw.
     */
    const magpie = hasMutator(run, 'magpie_thief')
        ? resolveMagpieVisit({
              board: spunMiss.board,
              guardTokens: penalty.guardTokens,
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
        lives: Math.max(penalty.lives, 0),
        board: boardAfterMagpie,
        shiftingSpotlightNonce: spunMiss.shiftingSpotlightNonce,
        magpieTheftsThisFloor:
            runNonNegativeInteger(run.magpieTheftsThisFloor) + (magpie?.kind === 'theft' ? 1 : 0),
        magpieScaredOffThisFloor:
            runNonNegativeInteger(run.magpieScaredOffThisFloor) + (magpie?.kind === 'scared_off' ? 1 : 0),
        pendingMemorizeBonusMs: penalty.pendingMemorizeBonusMs,
        stickyBlockIndex: null,
        recallFocus: decreaseRecallFocus(run),
        recallMistakesThisFloor: runNonNegativeInteger(run.recallMistakesThisFloor) + 1,
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
            /*
             * The magpie's token is spent here, not inside its own rules: it decides whether it
             * was driven off, and the run is what actually holds the tokens. A visit that reports
             * a spend and never deducts one is a protection the player pays nothing for.
             */
            guardTokens: Math.min(
                runNonNegativeInteger(penalty.guardTokens),
                magpie?.kind === 'scared_off'
                    ? runNonNegativeInteger(magpie.guardTokens)
                    : runNonNegativeInteger(penalty.guardTokens)
            ),
            tileTraitMismatches: addTileTraitCountStats(stats.tileTraitMismatches, sourceTiles)
        },
        timerState: clearResolveState(run)
    };
};
