import type { RunState, ViewState } from '../../shared/contracts';
import { finishMemorizePhase, isGauntletExpired } from '../../shared/game-core';
import { disableDebugPeek, pauseRun, resumeRun } from '../../shared/run-timer-rules';
import {
    clearActiveTimer,
    createActiveTimer,
    getActiveTimerRemainingMs,
    type ActiveTimer
} from './activeTimer';
import {
    shouldScheduleDebugRevealTimerOnResume,
    shouldScheduleMemorizeTimerOnResume
} from './runTimerResumeConditions';

interface RunTimerStoreSnapshot {
    run: RunState | null;
    view: ViewState;
}

interface RunTimerControllerOptions {
    getState: () => RunTimerStoreSnapshot;
    onResolveBoardTurn: (run: RunState) => void;
    onResolvedRun: (run: RunState) => void;
    setRun: (run: RunState) => void;
}

interface RunTimerController {
    clearAllTimers: () => void;
    clearResolveTimer: () => void;
    freezeRun: (run: RunState) => RunState;
    freezeRunSnapshotForPlayingMetaOverlay: (run: RunState) => RunState;
    getMemorizeBoardKey: (run: RunState) => string | null;
    notifyMemorizeBoardReady: (boardKey: string) => void;
    prepareMemorizeTimerForBoardReady: (run: RunState) => void;
    resumeRunWithTimers: (run: RunState) => RunState;
    scheduleDebugRevealTimer: (duration: number) => void;
    scheduleResolveTimer: (duration: number) => void;
    syncGauntletExpiryWatch: () => void;
}

export const createRunTimerController = ({
    getState,
    onResolveBoardTurn,
    onResolvedRun,
    setRun
}: RunTimerControllerOptions): RunTimerController => {
    let memorizeTimer: ActiveTimer | null = null;
    let resolveTimer: ActiveTimer | null = null;
    let debugRevealTimer: ActiveTimer | null = null;
    let pendingMemorizeBoardKey: string | null = null;
    let gauntletExpiryIntervalId: ReturnType<typeof setInterval> | null = null;

    const clearMemorizeTimer = (): void => {
        clearActiveTimer(memorizeTimer);
        memorizeTimer = null;
    };

    const getMemorizeBoardKey = (run: RunState): string | null =>
        run.board
            ? `${run.board.level}|${run.board.columns}x${run.board.rows}|${[...run.board.tiles]
                  .map((t) => t.id)
                  .sort()
                  .join('|')}`
            : null;

    const prepareMemorizeTimerForBoardReady = (run: RunState): void => {
        clearMemorizeTimer();
        pendingMemorizeBoardKey =
            run.status === 'memorize' && run.timerState.memorizeRemainingMs !== null
                ? getMemorizeBoardKey(run)
                : null;
    };

    const clearResolveTimer = (): void => {
        clearActiveTimer(resolveTimer);
        resolveTimer = null;
    };

    const clearDebugRevealTimer = (): void => {
        clearActiveTimer(debugRevealTimer);
        debugRevealTimer = null;
    };

    const clearGauntletExpiryWatch = (): void => {
        if (gauntletExpiryIntervalId !== null) {
            clearInterval(gauntletExpiryIntervalId);
            gauntletExpiryIntervalId = null;
        }
    };

    const syncGauntletExpiryWatch = (): void => {
        const { run, view } = getState();
        const shouldWatch =
            view === 'playing' &&
            run &&
            run.gameMode === 'gauntlet' &&
            run.gauntletDeadlineMs !== null &&
            run.status !== 'paused' &&
            run.status !== 'gameOver';

        if (!shouldWatch) {
            clearGauntletExpiryWatch();
            return;
        }

        if (gauntletExpiryIntervalId !== null) {
            return;
        }

        gauntletExpiryIntervalId = setInterval(() => {
            const { run: currentRun, view: currentView } = getState();
            if (
                !currentRun ||
                currentView !== 'playing' ||
                currentRun.gameMode !== 'gauntlet' ||
                currentRun.gauntletDeadlineMs === null ||
                currentRun.status === 'paused' ||
                currentRun.status === 'gameOver'
            ) {
                clearGauntletExpiryWatch();
                return;
            }
            if (isGauntletExpired(currentRun)) {
                clearGauntletExpiryWatch();
                onResolvedRun({ ...currentRun, status: 'gameOver', lives: 0 });
            }
        }, 300);
    };

    const clearAllTimers = (): void => {
        clearMemorizeTimer();
        clearResolveTimer();
        clearDebugRevealTimer();
        clearGauntletExpiryWatch();
        pendingMemorizeBoardKey = null;
    };

    const scheduleMemorizeTimer = (duration: number): void => {
        clearMemorizeTimer();
        pendingMemorizeBoardKey = null;

        if (duration <= 0) {
            const { run } = getState();

            if (run && run.status === 'memorize') {
                setRun(finishMemorizePhase(run));
            }

            return;
        }

        memorizeTimer = createActiveTimer(duration, () => {
            memorizeTimer = null;
            const { run } = getState();

            if (!run || run.status !== 'memorize') {
                return;
            }

            setRun(finishMemorizePhase(run));
        });
    };

    const scheduleResolveTimer = (duration: number): void => {
        clearResolveTimer();

        if (duration <= 0) {
            const { run } = getState();

            if (run && run.status === 'resolving') {
                onResolveBoardTurn(run);
            }

            return;
        }

        resolveTimer = createActiveTimer(duration, () => {
            resolveTimer = null;
            const { run } = getState();

            if (!run || run.status !== 'resolving') {
                return;
            }

            onResolveBoardTurn(run);
        });
    };

    const scheduleDebugRevealTimer = (duration: number): void => {
        clearDebugRevealTimer();

        if (duration <= 0) {
            const { run } = getState();

            if (run?.debugPeekActive) {
                setRun(disableDebugPeek(run));
            }

            return;
        }

        debugRevealTimer = createActiveTimer(duration, () => {
            debugRevealTimer = null;
            const { run } = getState();

            if (!run?.debugPeekActive) {
                return;
            }

            setRun(disableDebugPeek(run));
        });
    };

    const freezeRun = (run: RunState): RunState => {
        const pausedRun = pauseRun(run);

        return {
            ...pausedRun,
            timerState: {
                ...pausedRun.timerState,
                memorizeRemainingMs:
                    run.status === 'memorize'
                        ? getActiveTimerRemainingMs(memorizeTimer, run.timerState.memorizeRemainingMs)
                        : pausedRun.timerState.memorizeRemainingMs,
                resolveRemainingMs:
                    run.status === 'resolving'
                        ? getActiveTimerRemainingMs(resolveTimer, run.timerState.resolveRemainingMs)
                        : pausedRun.timerState.resolveRemainingMs,
                debugRevealRemainingMs: run.debugPeekActive
                    ? getActiveTimerRemainingMs(debugRevealTimer, run.timerState.debugRevealRemainingMs)
                    : pausedRun.timerState.debugRevealRemainingMs
            }
        };
    };

    const freezeRunSnapshotForPlayingMetaOverlay = (run: RunState): RunState =>
        run.status === 'paused' || run.status === 'levelComplete' || run.status === 'gameOver' ? run : freezeRun(run);

    const resumeRunWithTimers = (run: RunState): RunState => {
        const resumedRun = resumeRun(run);

        if (shouldScheduleMemorizeTimerOnResume(resumedRun)) {
            scheduleMemorizeTimer(resumedRun.timerState.memorizeRemainingMs!);
        }

        if (resumedRun.status === 'resolving' && resumedRun.timerState.resolveRemainingMs !== null) {
            scheduleResolveTimer(resumedRun.timerState.resolveRemainingMs);
        }

        if (shouldScheduleDebugRevealTimerOnResume(resumedRun)) {
            scheduleDebugRevealTimer(resumedRun.timerState.debugRevealRemainingMs!);
        }

        return resumedRun;
    };

    const notifyMemorizeBoardReady = (boardKey: string): void => {
        const { run, view } = getState();
        if (
            !run ||
            view !== 'playing' ||
            run.status !== 'memorize' ||
            run.timerState.memorizeRemainingMs === null ||
            memorizeTimer ||
            pendingMemorizeBoardKey !== boardKey ||
            getMemorizeBoardKey(run) !== boardKey
        ) {
            return;
        }

        scheduleMemorizeTimer(run.timerState.memorizeRemainingMs);
    };

    return {
        clearAllTimers,
        clearResolveTimer,
        freezeRun,
        freezeRunSnapshotForPlayingMetaOverlay,
        getMemorizeBoardKey,
        notifyMemorizeBoardReady,
        prepareMemorizeTimerForBoardReady,
        resumeRunWithTimers,
        scheduleDebugRevealTimer,
        scheduleResolveTimer,
        syncGauntletExpiryWatch
    };
};
