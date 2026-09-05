import type {
    RunState,
    ViewState
} from '../../shared/contracts';
import {
    openRouteSideRoom
} from '../../shared/route-rules';
import { createGameplayRouteChooseCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import {
    createLevelCompleteContinuationSurfaceResult,
    shouldPrepareMemorizeTimerForContinuation,
    type LevelCompleteContinuationSurfaceResult
} from './levelCompleteSurfaceState';
import { createDeadInterludeGameOverRun } from './sideRoomSurfaceState';
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
     *
     * Deliberately before the relic-offer guard below. The agreed length lands on a milestone
     * floor, and offering a table a relic draft for a run that is already over would be asking
     * them to build for floors nobody is going to play.
     */
    if (routePassAndPlayFinalFloorToGameOver(run, deps.applyResolvedRun)) {
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

    const command = createGameplayRouteChooseCommand(
        `route-choice:${run.runRulesVersion}:${run.runSeed}:${run.lastLevelResult?.level ?? run.board?.level ?? 0}:${choiceId}`,
        choiceId
    );
    const routeOutcome = reduceGameplayCommand(run, command);
    if (!routeOutcome.accepted) {
        return;
    }
    const journaledRun = appendGameplayJournal(routeOutcome.run, [command], routeOutcome.events);

    deps.clearAllTimers();
    applyContinuationResult(
        createLevelCompleteContinuationSurfaceResult(openRouteSideRoom(journaledRun), { includeSummaryShop: true }),
        deps
    );
};
