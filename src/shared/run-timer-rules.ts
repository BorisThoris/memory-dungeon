import {
    DEBUG_REVEAL_MS,
    type ResumableRunStatus,
    type RunState
} from './contracts';
import { isResumableLifecycleState, lifecycleStateFromRunStatus } from './run-lifecycle-machine';
import { runFiniteNumberOrNull } from './run-number-guards';

export const createTimerState = (overrides?: Partial<RunState['timerState']>): RunState['timerState'] => ({
    memorizeRemainingMs: null,
    resolveRemainingMs: null,
    debugRevealRemainingMs: null,
    pausedFromStatus: null,
    gauntletPausedAtMs: null,
    ...overrides
});

const timerStateForRun = (value: unknown): RunState['timerState'] =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? createTimerState(value as Partial<RunState['timerState']>)
        : createTimerState();

export const normalizeTimerTimestampMs = (value: unknown): number | null =>
    runFiniteNumberOrNull(value);

export const extendTimerTimestampMs = (value: unknown, deltaMs: number): number | null => {
    const timestamp = normalizeTimerTimestampMs(value);
    const safeDelta = normalizeTimerTimestampMs(deltaMs);
    return timestamp !== null && safeDelta !== null
        ? normalizeTimerTimestampMs(timestamp + Math.max(0, safeDelta))
        : timestamp;
};

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
    const timerState = timerStateForRun(run.timerState);
    const gauntletDeadlineMs = normalizeTimerTimestampMs(run.gauntletDeadlineMs);
    const gauntletPausedAtMs =
        run.gameMode === 'gauntlet' && gauntletDeadlineMs !== null
            ? normalizeTimerTimestampMs(Date.now())
            : (timerState.gauntletPausedAtMs ?? null);

    return {
        ...run,
        gauntletDeadlineMs,
        status: 'paused',
        timerState: {
            ...timerState,
            pausedFromStatus: run.status,
            gauntletPausedAtMs
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
            pendingRouteCardPlan: null,
            sideRoom: null,
            relicOffer: null,
            shopOffers: [],
            timerState: {
                ...timerState,
                pausedFromStatus: null,
                gauntletPausedAtMs: null
            }
        };
    }
    if (pausedFromStatus === 'resolving') {
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
                    ...timerState,
                    resolveRemainingMs: null,
                    pausedFromStatus: null,
                    gauntletPausedAtMs: null
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
                    pausedFromStatus: null,
                    gauntletPausedAtMs: null
                }
            };
        }
    }
    const gauntletDeadlineMs = normalizeTimerTimestampMs(run.gauntletDeadlineMs);
    const gauntletPausedAtMs = normalizeTimerTimestampMs(timerState.gauntletPausedAtMs);
    const gauntletPauseDeltaMs =
        run.gameMode === 'gauntlet' && gauntletDeadlineMs !== null && gauntletPausedAtMs !== null
            ? Math.max(0, Date.now() - gauntletPausedAtMs)
            : 0;

    return {
        ...run,
        gauntletDeadlineMs: extendTimerTimestampMs(gauntletDeadlineMs, gauntletPauseDeltaMs),
        status: pausedFromStatus,
        timerState: {
            ...timerState,
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
