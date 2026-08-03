import type { RunState, ViewState } from '../../shared/contracts';
import {
    completeMemorizePhaseThroughGameplayCore,
    deactivateDebugRevealThroughGameplayCore,
    expireGauntletThroughGameplayCore,
    pauseRunThroughGameplayCore,
    resumeRunThroughGameplayCore
} from '../../shared/gameplay-core-adapters';
import type { GameplayPauseTimerSnapshot } from '../../shared/gameplay-core-contracts';
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

    const completeMemorizePhase = (run: RunState): RunState =>
        completeMemorizePhaseThroughGameplayCore(
            run,
            `memorize-complete:${run.runSeed}:${run.board?.level ?? 0}`
        ).run;

    const expireGauntlet = (run: RunState, observedAtMs: number) =>
        expireGauntletThroughGameplayCore(
            run,
            observedAtMs,
            `gauntlet-expire:${run.runSeed}:${run.gauntletDeadlineMs ?? 'none'}:${observedAtMs}`
        );

    const commandJournalLength = (run: RunState): number =>
        Array.isArray(run.gameplayCommandJournal) ? run.gameplayCommandJournal.length : 0;

    const deactivateDebugReveal = (
        run: RunState,
        reason: 'timer_elapsed' | 'resume_expired'
    ): RunState =>
        deactivateDebugRevealThroughGameplayCore(
            run,
            reason,
            `debug-reveal-deactivate:${run.runSeed}:${commandJournalLength(run)}:${reason}`
        ).run;

    const timerRemainingMs = (value: number | null): number | null =>
        typeof value === 'number' && Number.isFinite(value)
            ? Math.max(0, Math.floor(value))
            : null;

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
            const expiry = expireGauntlet(currentRun, Date.now());
            if (expiry.accepted) {
                clearGauntletExpiryWatch();
                onResolvedRun(expiry.run);
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
                setRun(completeMemorizePhase(run));
            }

            return;
        }

        memorizeTimer = createActiveTimer(duration, () => {
            memorizeTimer = null;
            const { run } = getState();

            if (!run || run.status !== 'memorize') {
                return;
            }

            setRun(completeMemorizePhase(run));
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
                setRun(deactivateDebugReveal(run, 'timer_elapsed'));
            }

            return;
        }

        debugRevealTimer = createActiveTimer(duration, () => {
            debugRevealTimer = null;
            const { run } = getState();

            if (!run?.debugPeekActive) {
                return;
            }

            setRun(deactivateDebugReveal(run, 'timer_elapsed'));
        });
    };

    const freezeRun = (run: RunState): RunState => {
        const observedAtMs = Date.now();
        const timerSnapshot: GameplayPauseTimerSnapshot = {
            memorizeRemainingMs: timerRemainingMs(
                run.status === 'memorize'
                    ? getActiveTimerRemainingMs(memorizeTimer, run.timerState.memorizeRemainingMs, observedAtMs)
                    : run.timerState.memorizeRemainingMs
            ),
            resolveRemainingMs: timerRemainingMs(
                run.status === 'resolving'
                    ? getActiveTimerRemainingMs(resolveTimer, run.timerState.resolveRemainingMs, observedAtMs)
                    : run.timerState.resolveRemainingMs
            ),
            debugRevealRemainingMs: timerRemainingMs(
                run.debugPeekActive
                    ? getActiveTimerRemainingMs(debugRevealTimer, run.timerState.debugRevealRemainingMs, observedAtMs)
                    : run.timerState.debugRevealRemainingMs
            )
        };
        return pauseRunThroughGameplayCore(
            run,
            observedAtMs,
            timerSnapshot,
            `run-pause:${run.runSeed}:${commandJournalLength(run)}:${observedAtMs}`
        ).run;
    };

    const freezeRunSnapshotForPlayingMetaOverlay = (run: RunState): RunState =>
        run.status === 'paused' || run.status === 'levelComplete' || run.status === 'gameOver' ? run : freezeRun(run);

    const resumeRunWithTimers = (run: RunState): RunState => {
        const observedAtMs = Date.now();
        let resumedRun = resumeRunThroughGameplayCore(
            run,
            observedAtMs,
            `run-resume:${run.runSeed}:${commandJournalLength(run)}:${observedAtMs}`
        ).run;
        const memorizeRemainingMs = resumedRun.timerState.memorizeRemainingMs;

        if (shouldScheduleMemorizeTimerOnResume(resumedRun) && memorizeRemainingMs !== null) {
            if (memorizeRemainingMs <= 0) {
                resumedRun = completeMemorizePhase(resumedRun);
            } else {
                scheduleMemorizeTimer(memorizeRemainingMs);
            }
        }

        if (resumedRun.status === 'resolving' && resumedRun.timerState.resolveRemainingMs !== null) {
            scheduleResolveTimer(resumedRun.timerState.resolveRemainingMs);
        }

        const debugRevealRemainingMs = resumedRun.timerState.debugRevealRemainingMs;
        if (shouldScheduleDebugRevealTimerOnResume(resumedRun) && debugRevealRemainingMs !== null) {
            if (debugRevealRemainingMs <= 0) {
                resumedRun = deactivateDebugReveal(resumedRun, 'resume_expired');
            } else {
                scheduleDebugRevealTimer(debugRevealRemainingMs);
            }
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
