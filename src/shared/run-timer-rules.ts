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
    gauntletPausedAtMs: null,
    ...overrides
});

export const clearResolveState = (run: RunState): RunState['timerState'] => ({
    ...run.timerState,
    resolveRemainingMs: null,
    pausedFromStatus: null
});

export const isResumableStatus = (status: RunState['status']): status is ResumableRunStatus =>
    isResumableLifecycleState(lifecycleStateFromRunStatus(status));

export const pauseRun = (run: RunState): RunState => {
    if (!isResumableStatus(run.status)) {
        return run;
    }
    const gauntletPausedAtMs =
        run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null
            ? Date.now()
            : (run.timerState.gauntletPausedAtMs ?? null);

    return {
        ...run,
        status: 'paused',
        timerState: {
            ...run.timerState,
            pausedFromStatus: run.status,
            gauntletPausedAtMs
        }
    };
};

export const resumeRun = (run: RunState): RunState => {
    if (run.status !== 'paused' || !run.timerState.pausedFromStatus) {
        return run;
    }
    if (run.lives <= 0) {
        return {
            ...run,
            status: 'gameOver',
            lives: 0,
            pendingRouteCardPlan: null,
            sideRoom: null,
            relicOffer: null,
            shopOffers: [],
            timerState: {
                ...run.timerState,
                pausedFromStatus: null,
                gauntletPausedAtMs: null
            }
        };
    }
    if (run.timerState.pausedFromStatus === 'resolving') {
        if (!run.board) {
            return {
                ...run,
                status: 'gameOver',
                lives: 0,
                pendingRouteCardPlan: null,
                sideRoom: null,
                relicOffer: null,
                shopOffers: [],
                timerState: {
                    ...run.timerState,
                    resolveRemainingMs: null,
                    pausedFromStatus: null,
                    gauntletPausedAtMs: null
                }
            };
        }
        if (run.board.flippedTileIds.length < 2) {
            return {
                ...run,
                status: 'playing',
                timerState: {
                    ...run.timerState,
                    resolveRemainingMs: null,
                    pausedFromStatus: null,
                    gauntletPausedAtMs: null
                }
            };
        }
    }
    const gauntletPausedAtMs = run.timerState.gauntletPausedAtMs ?? null;
    const gauntletPauseDeltaMs =
        run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null && gauntletPausedAtMs !== null
            ? Math.max(0, Date.now() - gauntletPausedAtMs)
            : 0;

    return {
        ...run,
        gauntletDeadlineMs:
            run.gauntletDeadlineMs !== null ? run.gauntletDeadlineMs + gauntletPauseDeltaMs : run.gauntletDeadlineMs,
        status: run.timerState.pausedFromStatus,
        timerState: {
            ...run.timerState,
            pausedFromStatus: null,
            gauntletPausedAtMs: null
        }
    };
};

export const enableDebugPeek = (run: RunState, disableAchievementsOnDebug: boolean): RunState => ({
    ...run,
    debugPeekActive: true,
    debugUsed: true,
    achievementsEnabled: disableAchievementsOnDebug ? false : run.achievementsEnabled,
    timerState: {
        ...run.timerState,
        debugRevealRemainingMs: DEBUG_REVEAL_MS
    }
});

export const disableDebugPeek = (run: RunState): RunState =>
    run.debugPeekActive
        ? {
              ...run,
              debugPeekActive: false,
              timerState: {
                  ...run.timerState,
                  debugRevealRemainingMs: null
              }
          }
        : run;
