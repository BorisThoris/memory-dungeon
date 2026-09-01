import type { RunState } from '../../shared/contracts';
import {
    canPauseRunSurface,
    createPausedRunSurfacePatch,
    type RunSurfaceState
} from './runSurfaceState';

export interface PauseResumeExecutorState {
    run: RunState | null;
}

type PauseResumeMutableState = PauseResumeExecutorState &
    Pick<RunSurfaceState, 'matchScorePop' | 'mismatchScorePop'>;

export interface PauseResumeExecutorDeps {
    applyResolvedRun: (run: RunState) => void;
    clearAllTimers: () => void;
    freezeRun: (run: RunState) => RunState;
    getState: () => PauseResumeExecutorState;
    playPauseOpenSfx: () => void;
    playPauseResumeSfx: () => void;
    resumeRunWithTimers: (run: RunState) => RunState;
    resumeUiSfxContext: () => void;
    setState: (patch: Partial<PauseResumeMutableState>) => void;
}

export const executePauseRun = (deps: PauseResumeExecutorDeps): void => {
    const { run } = deps.getState();

    if (!canPauseRunSurface(run)) {
        return;
    }

    // Serialize BEFORE clearing. freezeRun reads the live browser timers to work out how
    // much of the memorize/resolve window is actually left; clearing first nulls those
    // refs, so the snapshot silently fell back to the stale stored value and the run
    // resumed with the full window instead of the remaining one.
    const pausedPatch = createPausedRunSurfacePatch(run, deps.freezeRun);

    deps.clearAllTimers();
    deps.resumeUiSfxContext();
    deps.playPauseOpenSfx();
    deps.setState(pausedPatch);
};

export const executeResumeRun = (deps: PauseResumeExecutorDeps): void => {
    const { run } = deps.getState();

    if (!run || run.status !== 'paused' || !run.timerState.pausedFromStatus) {
        return;
    }

    const nextRun = deps.resumeRunWithTimers(run);
    if (nextRun.status === 'gameOver') {
        deps.applyResolvedRun(nextRun);
        return;
    }

    deps.resumeUiSfxContext();
    deps.playPauseResumeSfx();
    deps.setState({ run: nextRun });
};
