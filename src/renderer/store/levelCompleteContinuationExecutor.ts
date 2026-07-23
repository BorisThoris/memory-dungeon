import type {
    RunState,
    ViewState
} from '../../shared/contracts';
import {
    applyRouteChoiceOutcome,
    openRouteSideRoom
} from '../../shared/route-rules';
import {
    createLevelCompleteContinuationSurfaceResult,
    shouldPrepareMemorizeTimerForContinuation,
    type LevelCompleteContinuationSurfaceResult
} from './levelCompleteSurfaceState';
import { createDeadInterludeGameOverRun } from './sideRoomSurfaceState';

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

    if (run.gameMode === 'puzzle' || run.relicOffer) {
        return;
    }

    deps.clearAllTimers();
    applyContinuationResult(
        createLevelCompleteContinuationSurfaceResult(run, { includeSummaryShop: false }),
        deps
    );
};

export const executeChooseRouteAndContinue = (
    choiceId: string,
    deps: LevelCompleteContinuationExecutorDeps
): void => {
    const { run, view } = deps.getState();

    if (!run || view !== 'playing' || run.status !== 'levelComplete') {
        return;
    }
    if (run.pendingRouteCardPlan) {
        deps.continueToNextLevel();
        return;
    }

    const routeOutcome = applyRouteChoiceOutcome(run, choiceId);
    if (!routeOutcome.applied) {
        return;
    }

    deps.clearAllTimers();
    applyContinuationResult(
        createLevelCompleteContinuationSurfaceResult(openRouteSideRoom(routeOutcome.run), { includeSummaryShop: true }),
        deps
    );
};
