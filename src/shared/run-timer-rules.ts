import {
    DEBUG_REVEAL_MS,
    type ResumableRunStatus,
    type RunState
} from './contracts';
import { isResumableLifecycleState, lifecycleStateFromRunStatus } from './run-lifecycle-machine';

export const createTimerState = (overrides?: Partial<RunState['timerState']>): RunState['timerState'] => ({
    memorizeRemainingMs: null,
    resolveRemainingMs: null,
    debugRevealRemainingMs: null,
    pausedFromStatus: null,
    ...overrides
});

const timerStateForRun = (value: unknown): RunState['timerState'] =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? createTimerState(value as Partial<RunState['timerState']>)
        : createTimerState();

export const clearResolveState = (run: RunState): RunState['timerState'] => ({
    ...timerStateForRun(run.timerState),
    resolveRemainingMs: null,
    pausedFromStatus: null
});

export const isResumableStatus = (status: RunState['status']): status is ResumableRunStatus =>
    isResumableLifecycleState(lifecycleStateFromRunStatus(status));

export const pauseRun = (run: RunState): RunState => {
    if (!isResumableStatus(run.status)) {
        return run;
    }
    return {
        ...run,
        status: 'paused',
        timerState: {
            ...timerStateForRun(run.timerState),
            pausedFromStatus: run.status
        }
    };
};

export const resumeRun = (run: RunState): RunState => {
    const timerState = timerStateForRun(run.timerState);
    const pausedFromStatus = timerState.pausedFromStatus;
    if (run.status !== 'paused' || !pausedFromStatus || !isResumableStatus(pausedFromStatus)) {
        return run;
    }
    if (run.lives <= 0) {
        return {
            ...run,
            status: 'gameOver',
            lives: 0,
            timerState: {
                ...timerState,
                pausedFromStatus: null
            }
        };
    }
    if (pausedFromStatus === 'resolving') {
        if (!run.board) {
            return {
                ...run,
                status: 'gameOver',
                lives: 0,
                timerState: {
                    ...timerState,
                    resolveRemainingMs: null,
                    pausedFromStatus: null
                }
            };
        }
        if (!Array.isArray(run.board.flippedTileIds) || run.board.flippedTileIds.length < 2) {
            return {
                ...run,
                status: 'playing',
                timerState: {
                    ...timerState,
                    resolveRemainingMs: null,
                    pausedFromStatus: null
                }
            };
        }
    }
    return {
        ...run,
        status: pausedFromStatus,
        timerState: {
            ...timerState,
            pausedFromStatus: null
        }
    };
};

export const enableDebugPeek = (run: RunState, disableAchievementsOnDebug: boolean): RunState => ({
    ...run,
    debugPeekActive: true,
    debugUsed: true,
    achievementsEnabled: disableAchievementsOnDebug ? false : run.achievementsEnabled,
    timerState: {
        ...timerStateForRun(run.timerState),
        debugRevealRemainingMs: DEBUG_REVEAL_MS
    }
});

export const disableDebugPeek = (run: RunState): RunState =>
    run.debugPeekActive
        ? {
              ...run,
              debugPeekActive: false,
              timerState: {
                  ...timerStateForRun(run.timerState),
                  debugRevealRemainingMs: null
              }
          }
        : run;
