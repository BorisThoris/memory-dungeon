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

    deps.clearAllTimers();
    deps.resumeUiSfxContext();
    deps.playPauseOpenSfx();
    deps.setState(createPausedRunSurfacePatch(run, deps.freezeRun));
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
