import { describe, expect, it, vi } from 'vitest';
import type { RunState } from '../../shared/contracts';
import { createNewRun } from '../../shared/run-creation-rules';
import {
    executePauseRun,
    executeResumeRun,
    type PauseResumeExecutorDeps,
    type PauseResumeExecutorState
} from './pauseResumeExecutor';

const createPlayingRun = (): RunState => ({
    ...createNewRun(0, { echoFeedbackEnabled: false }),
    status: 'playing'
});

const createPausedRun = (): RunState => ({
    ...createPlayingRun(),
    status: 'paused',
    timerState: {
        debugRevealRemainingMs: null,
        memorizeRemainingMs: null,
        pausedFromStatus: 'playing',
        resolveRemainingMs: null
    }
});

const createDeps = (state: PauseResumeExecutorState): PauseResumeExecutorDeps => ({
    applyResolvedRun: vi.fn(),
    clearAllTimers: vi.fn(),
    freezeRun: vi.fn((run) => ({ ...run, status: 'paused' })),
    getState: vi.fn(() => state),
    playPauseOpenSfx: vi.fn(),
    playPauseResumeSfx: vi.fn(),
    resumeRunWithTimers: vi.fn((run) => ({ ...run, status: 'playing' })),
    resumeUiSfxContext: vi.fn(),
    setState: vi.fn()
});

describe('pause/resume executors', () => {
    it('ignores pause requests when the run cannot be paused', () => {
        const deps = createDeps({ run: { ...createPlayingRun(), status: 'levelComplete' } });

        executePauseRun(deps);

        expect(deps.clearAllTimers).not.toHaveBeenCalled();
        expect(deps.setState).not.toHaveBeenCalled();
    });

    it('freezes pausable runs and plays pause UI feedback', () => {
        const run = createPlayingRun();
        const deps = createDeps({ run });

        executePauseRun(deps);

        expect(deps.clearAllTimers).toHaveBeenCalledTimes(1);
        expect(deps.resumeUiSfxContext).toHaveBeenCalledTimes(1);
        expect(deps.playPauseOpenSfx).toHaveBeenCalledTimes(1);
        expect(deps.freezeRun).toHaveBeenCalledWith(run);
        expect(deps.setState).toHaveBeenCalledWith({
            matchScorePop: null,
            mismatchScorePop: null,
            run: { ...run, status: 'paused' }
        });
    });

    it('resumes paused runs and plays resume UI feedback', () => {
        const run = createPausedRun();
        const deps = createDeps({ run });

        executeResumeRun(deps);

        expect(deps.resumeRunWithTimers).toHaveBeenCalledWith(run);
        expect(deps.resumeUiSfxContext).toHaveBeenCalledTimes(1);
        expect(deps.playPauseResumeSfx).toHaveBeenCalledTimes(1);
        expect(deps.setState).toHaveBeenCalledWith({ run: { ...run, status: 'playing' } });
    });

    it('routes game-over resumes through resolved-run handling', () => {
        const run = createPausedRun();
        const gameOverRun = { ...run, status: 'gameOver' as const, lives: 0 };
        const deps = {
            ...createDeps({ run }),
            resumeRunWithTimers: vi.fn(() => gameOverRun)
        };

        executeResumeRun(deps);

        expect(deps.applyResolvedRun).toHaveBeenCalledWith(gameOverRun);
        expect(deps.playPauseResumeSfx).not.toHaveBeenCalled();
        expect(deps.setState).not.toHaveBeenCalled();
    });
});
