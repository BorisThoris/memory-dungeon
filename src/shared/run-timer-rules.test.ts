import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEBUG_REVEAL_MS, type RunState } from './contracts';
import { createGauntletRun, createNewRun, finishMemorizePhase } from './game-core';
import {
    clearResolveState,
    createTimerState,
    disableDebugPeek,
    enableDebugPeek,
    isResumableStatus,
    pauseRun,
    resumeRun
} from './run-timer-rules';

describe('run timer rules', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('creates and clears timer state without touching unrelated timer fields', () => {
        const timerState = createTimerState({ resolveRemainingMs: 120 });
        expect(timerState).toEqual({
            memorizeRemainingMs: null,
            resolveRemainingMs: 120,
            debugRevealRemainingMs: null,
            pausedFromStatus: null,
            gauntletPausedAtMs: null
        });
        expect(clearResolveState({ ...createNewRun(0), timerState }).resolveRemainingMs).toBeNull();
    });

    it('identifies statuses that can be paused', () => {
        expect(isResumableStatus('memorize')).toBe(true);
        expect(isResumableStatus('playing')).toBe(true);
        expect(isResumableStatus('resolving')).toBe(true);
        expect(isResumableStatus('levelComplete')).toBe(false);
    });

    it('pauses and resumes normal runs through the original status', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const paused = pauseRun(playing);
        expect(paused.status).toBe('paused');
        expect(paused.timerState.pausedFromStatus).toBe('playing');
        const resumed = resumeRun(paused);
        expect(resumed.status).toBe('playing');
        expect(resumed.timerState.pausedFromStatus).toBeNull();
    });

    it('does not resume dead or corrupted paused resolving runs into play', () => {
        const playing = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false }));
        const pausedDead = { ...pauseRun(playing), lives: 0 };
        expect(resumeRun(pausedDead).status).toBe('gameOver');

        const missingBoardPause: RunState = {
            ...playing,
            status: 'paused',
            board: null,
            timerState: {
                ...playing.timerState,
                pausedFromStatus: 'resolving',
                resolveRemainingMs: 120
            }
        };
        const missingBoard = resumeRun(missingBoardPause);
        expect(missingBoard.status).toBe('gameOver');
        expect(missingBoard.timerState.resolveRemainingMs).toBeNull();

        const noFlipsPause: RunState = {
            ...playing,
            status: 'paused',
            board: playing.board ? { ...playing.board, flippedTileIds: [] } : playing.board,
            timerState: {
                ...playing.timerState,
                pausedFromStatus: 'resolving',
                resolveRemainingMs: 120
            }
        };
        const noFlips = resumeRun(noFlipsPause);
        expect(noFlips.status).toBe('playing');
        expect(noFlips.timerState.resolveRemainingMs).toBeNull();
    });

    it('extends gauntlet deadlines by paused wall-clock time', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000);
        const playing = finishMemorizePhase(createGauntletRun(0, 60_000));
        const paused = pauseRun(playing);
        vi.setSystemTime(2_500);
        const resumed = resumeRun(paused);
        expect(resumed.gauntletDeadlineMs).toBe((playing.gauntletDeadlineMs ?? 0) + 1_500);
        expect(resumed.timerState.gauntletPausedAtMs).toBeNull();
    });

    it('toggles debug peek timers and achievement disabling', () => {
        const run = createNewRun(0);
        const debug = enableDebugPeek(run, true);
        expect(debug.debugPeekActive).toBe(true);
        expect(debug.debugUsed).toBe(true);
        expect(debug.achievementsEnabled).toBe(false);
        expect(debug.timerState.debugRevealRemainingMs).toBe(DEBUG_REVEAL_MS);
        expect(disableDebugPeek(debug).timerState.debugRevealRemainingMs).toBeNull();
    });
});
