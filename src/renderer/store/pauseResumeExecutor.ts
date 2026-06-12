import type { RunState } from '../../shared/contracts';
import {
    canPauseRunSurface,
    createPausedRunSurfacePatch
} from './runSurfaceState';

type PauseRunPatch = ReturnType<typeof createPausedRunSurfacePatch>;

export interface PauseResumeExecutorState {
    run: RunState | null;
}

export interface PauseResumeExecutorDeps<State extends PauseResumeExecutorState> {
    applyResolvedRun: (run: RunState) => void;
    clearAllTimers: () => void;
    freezeRun: (run: RunState) => RunState;
    getState: () => State;
    playPauseOpenSfx: () => void;
    playPauseResumeSfx: () => void;
    resumeRunWithTimers: (run: RunState) => RunState;
    resumeUiSfxContext: () => void;
    setState: (patch: Partial<State> | PauseRunPatch) => void;
}

export const executePauseRun = <State extends PauseResumeExecutorState>(
    deps: PauseResumeExecutorDeps<State>
): void => {
    const { run } = deps.getState();

    if (!canPauseRunSurface(run)) {
        return;
    }

    deps.clearAllTimers();
    deps.resumeUiSfxContext();
    deps.playPauseOpenSfx();
    deps.setState(createPausedRunSurfacePatch(run, deps.freezeRun));
};

export const executeResumeRun = <State extends PauseResumeExecutorState>(
    deps: PauseResumeExecutorDeps<State>
): void => {
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
    deps.setState({ run: nextRun } as Partial<State>);
};
