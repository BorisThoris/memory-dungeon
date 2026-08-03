import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunState, ViewState } from '../../shared/contracts';
import { createNewRun, finishMemorizePhase } from '../../shared/game-core';
import { enableDebugPeek, pauseRun } from '../../shared/run-timer-rules';
import { createRunTimerController } from './runTimerController';

interface Harness {
    onResolveBoardTurn: ReturnType<typeof vi.fn>;
    onResolvedRun: ReturnType<typeof vi.fn>;
    setRun: ReturnType<typeof vi.fn>;
    setState: (patch: Partial<{ run: RunState | null; view: ViewState }>) => void;
    state: { run: RunState | null; view: ViewState };
    timer: ReturnType<typeof createRunTimerController>;
}

const createHarnessWithCallbacks = (initialRun: RunState | null): Harness => {
    const state: { run: RunState | null; view: ViewState } = {
        run: initialRun,
        view: 'playing'
    };
    const setRun = vi.fn((run: RunState) => {
        state.run = run;
    });
    const onResolveBoardTurn = vi.fn();
    const onResolvedRun = vi.fn();
    const timer = createRunTimerController({
        getState: () => state,
        onResolveBoardTurn: onResolveBoardTurn as (run: RunState) => void,
        onResolvedRun: onResolvedRun as (run: RunState) => void,
        setRun
    });

    return {
        onResolveBoardTurn,
        onResolvedRun,
        setRun,
        setState: (patch) => {
            Object.assign(state, patch);
        },
        state,
        timer
    };
};

afterEach(() => {
    vi.useRealTimers();
});

describe('runTimerController', () => {
    it('starts memorize countdown only after the matching board-ready key arrives', async () => {
        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const run: RunState = {
            ...base,
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: 500
            }
        };
        const harness = createHarnessWithCallbacks(run);
        const boardKey = harness.timer.getMemorizeBoardKey(run);

        harness.timer.prepareMemorizeTimerForBoardReady(run);
        harness.timer.notifyMemorizeBoardReady('stale-board');
        await vi.advanceTimersByTimeAsync(600);

        expect(harness.setRun).not.toHaveBeenCalled();

        harness.timer.notifyMemorizeBoardReady(boardKey ?? '');
        await vi.advanceTimersByTimeAsync(501);

        expect(harness.setRun).toHaveBeenCalledTimes(1);
        expect(harness.state.run?.status).toBe('playing');
        expect(harness.state.run?.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'phase.memorize_complete' })
        ]);
        expect(harness.state.run?.gameplayEventJournal).toEqual([
            expect.objectContaining({ type: 'phase.memorize_completed' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'phase.memorize.completed' })
        ]);
    });

    it('snapshots remaining memorize time when freezing an active memorize run', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const run: RunState = {
            ...base,
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: 1000
            }
        };
        const harness = createHarnessWithCallbacks(run);
        const boardKey = harness.timer.getMemorizeBoardKey(run);

        harness.timer.prepareMemorizeTimerForBoardReady(run);
        harness.timer.notifyMemorizeBoardReady(boardKey ?? '');
        vi.advanceTimersByTime(350);

        const frozen = harness.timer.freezeRun(run);

        expect(frozen.status).toBe('paused');
        expect(frozen.timerState.pausedFromStatus).toBe('memorize');
        expect(frozen.timerState.memorizeRemainingMs).toBe(650);
        expect(frozen.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.pause', timerSnapshot: expect.objectContaining({ memorizeRemainingMs: 650 }) })
        ]);
        expect(frozen.gameplayEventJournal).toEqual([
            expect.objectContaining({ type: 'run.paused', timerSnapshot: expect.objectContaining({ memorizeRemainingMs: 650 }) }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'run.paused' })
        ]);
    });

    it('resumes a paused resolving run and fires the delayed resolve callback', async () => {
        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const flippedTileIds = base.board?.tiles.slice(0, 2).map((tile) => tile.id) ?? [];
        const resolvingRun: RunState = {
            ...base,
            board: base.board ? { ...base.board, flippedTileIds } : base.board,
            status: 'resolving',
            timerState: {
                ...base.timerState,
                resolveRemainingMs: 250
            }
        };
        const pausedRun = pauseRun(resolvingRun);
        const harness = createHarnessWithCallbacks(pausedRun);

        const resumed = harness.timer.resumeRunWithTimers(pausedRun);
        harness.setState({ run: resumed });
        await vi.advanceTimersByTimeAsync(251);

        expect(resumed.status).toBe('resolving');
        expect(resumed.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.resume' })
        ]);
        expect(resumed.gameplayEventJournal).toEqual([
            expect.objectContaining({ type: 'run.resumed', statusAfter: 'resolving' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'run.resumed' })
        ]);
        expect(harness.onResolveBoardTurn).toHaveBeenCalledWith(resumed);
    });

    it('resumes a paused memorize run with zero remaining time through the returned run state', () => {
        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const memorizeRun: RunState = {
            ...base,
            status: 'memorize',
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: 0
            }
        };
        const pausedRun = pauseRun(memorizeRun);
        const harness = createHarnessWithCallbacks(pausedRun);

        const resumed = harness.timer.resumeRunWithTimers(pausedRun);

        expect(resumed.status).toBe('playing');
        expect(resumed.timerState.memorizeRemainingMs).toBeNull();
        expect(resumed.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.resume' }),
            expect.objectContaining({ type: 'phase.memorize_complete' })
        ]);
        expect(resumed.gameplayEventJournal).toEqual([
            expect.objectContaining({ type: 'run.resumed', statusAfter: 'memorize' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'run.resumed' }),
            expect.objectContaining({ type: 'phase.memorize_completed' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'phase.memorize.completed' })
        ]);
        expect(harness.setRun).not.toHaveBeenCalled();
    });

    it('resumes a paused debug reveal with zero remaining time through the returned run state', () => {
        vi.useFakeTimers();
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
        const debugPeekRun = enableDebugPeek(playing, false);
        const debugRun: RunState = {
            ...debugPeekRun,
            timerState: {
                ...debugPeekRun.timerState,
                debugRevealRemainingMs: 0
            }
        };
        const pausedRun = pauseRun(debugRun);
        const harness = createHarnessWithCallbacks(pausedRun);

        const resumed = harness.timer.resumeRunWithTimers(pausedRun);

        expect(resumed.debugPeekActive).toBe(false);
        expect(resumed.timerState.debugRevealRemainingMs).toBeNull();
        expect(resumed.gameplayCommandJournal).toEqual([
            expect.objectContaining({ type: 'run.resume' }),
            expect.objectContaining({ type: 'debug.reveal_deactivate', reason: 'resume_expired' })
        ]);
        expect(resumed.gameplayEventJournal).toEqual([
            expect.objectContaining({ type: 'run.resumed', statusAfter: 'playing' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'run.resumed' }),
            expect.objectContaining({ type: 'debug.reveal_deactivated', reason: 'resume_expired' }),
            expect.objectContaining({ type: 'feedback.requested', cue: 'debug.reveal.resume_expired' })
        ]);
        expect(harness.setRun).not.toHaveBeenCalled();
    });

    it('expires an active debug reveal through a journaled timer lifecycle command', async () => {
        vi.useFakeTimers();
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' }));
        const debugRun = enableDebugPeek(playing, false);
        const harness = createHarnessWithCallbacks(debugRun);

        harness.timer.scheduleDebugRevealTimer(75);
        await vi.advanceTimersByTimeAsync(76);

        expect(harness.setRun).toHaveBeenCalledTimes(1);
        expect(harness.state.run).toMatchObject({
            debugPeekActive: false,
            timerState: { debugRevealRemainingMs: null },
            gameplayCommandJournal: [
                expect.objectContaining({ type: 'debug.reveal_deactivate', reason: 'timer_elapsed' })
            ],
            gameplayEventJournal: [
                expect.objectContaining({ type: 'debug.reveal_deactivated', reason: 'timer_elapsed' }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'debug.reveal.timer_elapsed' })
            ]
        });
    });

    it('routes expired gauntlet runs through the resolved-run callback', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(10_000);
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'gauntlet' });
        const run: RunState = {
            ...base,
            gameMode: 'gauntlet',
            gauntletDeadlineMs: 9_999,
            status: 'playing'
        };
        const harness = createHarnessWithCallbacks(run);

        harness.timer.syncGauntletExpiryWatch();
        await vi.advanceTimersByTimeAsync(301);

        expect(harness.onResolvedRun).toHaveBeenCalledWith(expect.objectContaining({
            lives: 0,
            status: 'gameOver',
            gameplayCommandJournal: [expect.objectContaining({ type: 'run.gauntlet_expire' })],
            gameplayEventJournal: [
                expect.objectContaining({
                    type: 'run.gauntlet_expired',
                    observedAtMs: 10_300,
                    deadlineMs: 9_999,
                    overdueMs: 301
                }),
                expect.objectContaining({ type: 'feedback.requested', cue: 'mode.gauntlet.expired' })
            ]
        }));
    });

    it('clears pending resolve timers without clearing memorize board readiness', async () => {
        vi.useFakeTimers();
        const base = createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'puzzle' });
        const run: RunState = {
            ...base,
            timerState: {
                ...base.timerState,
                memorizeRemainingMs: 100,
                resolveRemainingMs: 100
            }
        };
        const harness = createHarnessWithCallbacks(run);
        const boardKey = harness.timer.getMemorizeBoardKey(run);

        harness.timer.prepareMemorizeTimerForBoardReady(run);
        harness.setState({ run: { ...run, status: 'resolving' } });
        harness.timer.scheduleResolveTimer(100);
        harness.timer.clearResolveTimer();
        harness.setState({ run });
        harness.timer.notifyMemorizeBoardReady(boardKey ?? '');
        await vi.advanceTimersByTimeAsync(101);

        expect(harness.onResolveBoardTurn).not.toHaveBeenCalled();
        expect(harness.setRun).toHaveBeenCalledTimes(1);
        expect(harness.state.run?.status).toBe('playing');
    });
});
