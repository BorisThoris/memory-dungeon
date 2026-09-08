import type {
    RunState,
    ViewState
} from '../../shared/contracts';
import {
    createLevelCompleteContinuationSurfaceResult,
    shouldPrepareMemorizeTimerForContinuation,
    type LevelCompleteContinuationSurfaceResult
} from './levelCompleteSurfaceState';
import { isPassAndPlayFinalFloor, isPassAndPlayRun } from '../../shared/pass-and-play-rules';

type ContinuationPatch = Exclude<LevelCompleteContinuationSurfaceResult, { kind: 'gameOver' }>['patch'];

export interface LevelCompleteContinuationExecutorState {
    run: RunState | null;
    view: ViewState;
}

export interface LevelCompleteContinuationExecutorDeps {
    applyResolvedRun: (run: RunState) => void;
    clearAllTimers: () => void;
    continueToNextLevel: () => void;
    getState: () => LevelCompleteContinuationExecutorState;
    prepareMemorizeTimerForBoardReady: (run: RunState) => void;
    setState: (patch: ContinuationPatch) => void;
}

/*
 * A run that reached the floor-clear interlude with no lives left is over, whatever else the
 * interlude was about to offer. This used to live in the side-room surface, which went with the
 * route layer in Gen 173; the guard stays because dying on the last match of a floor still lands
 * here.
 */
const createDeadInterludeGameOverRun = (run: RunState): RunState | null => {
    if (run.status !== 'gameOver' && run.lives > 0) {
        return null;
    }
    return {
        ...run,
        status: 'gameOver',
        lives: 0
    };
};

const routeDeadInterludeRunToGameOver = (
    run: RunState,
    applyResolvedRun: (run: RunState) => void
): boolean => {
    const gameOverRun = createDeadInterludeGameOverRun(run);

    if (!gameOverRun) {
        return false;
    }

    applyResolvedRun(gameOverRun);
    return true;
};

const routePassAndPlayFinalFloorToGameOver = (
    run: RunState,
    applyResolvedRun: (run: RunState) => void
): boolean => {
    const clearedLevel = run.lastLevelResult?.level ?? run.board?.level ?? 0;
    if (!isPassAndPlayRun(run.passAndPlay) || !isPassAndPlayFinalFloor(clearedLevel)) {
        return false;
    }
    applyResolvedRun({ ...run, status: 'gameOver' });
    return true;
};

const applyContinuationResult = (
    continuation: LevelCompleteContinuationSurfaceResult,
    deps: LevelCompleteContinuationExecutorDeps
): void => {
    if (continuation.kind === 'gameOver') {
        deps.applyResolvedRun(continuation.run);
        return;
    }

    deps.setState(continuation.patch);

    if (shouldPrepareMemorizeTimerForContinuation(continuation)) {
        deps.prepareMemorizeTimerForBoardReady(continuation.run);
    }
};

export const executeContinueToNextLevel = (deps: LevelCompleteContinuationExecutorDeps): void => {
    const { run } = deps.getState();

    if (!run || run.status !== 'levelComplete') {
        return;
    }

    if (routeDeadInterludeRunToGameOver(run, deps.applyResolvedRun)) {
        return;
    }

    /*
     * A shared game is a contest of an agreed length, not an endless descent: once the last floor
     * is cleared the table is done and the standings decide it. Ending here rather than inside the
     * turn rules keeps the board, the floors and the lives exactly as a solo run has them — the
     * only thing multiplayer changes is when the run stops.
     */
    if (routePassAndPlayFinalFloorToGameOver(run, deps.applyResolvedRun)) {
        return;
    }

    deps.clearAllTimers();
    applyContinuationResult(
        createLevelCompleteContinuationSurfaceResult(run),
        deps
    );
};
