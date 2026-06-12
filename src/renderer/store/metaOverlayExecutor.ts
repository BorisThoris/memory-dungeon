import type {
    RunState,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import {
    resolveNavigationTransition,
    type StoreNavigationAction
} from './navigationModel';
import {
    createMetaOverlayCloseSurfaceResult,
    createMetaOverlayOpenSurfaceResult,
    type MetaOverlayReturnPointer,
    type MetaOverlayStatePatch
} from './metaOverlayState';

export interface MetaOverlayExecutorState {
    run: RunState | null;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}

export interface MetaOverlayExecutorDeps<State extends MetaOverlayExecutorState> {
    applyResolvedRun: (run: RunState) => void;
    clearAllTimers: () => void;
    freezeRunSnapshotForPlayingMetaOverlay: (run: RunState) => RunState;
    getState: () => State;
    resumeRunWithTimers: (run: RunState) => RunState;
    setState: (patch: Partial<State>) => void;
}

export const executeMetaOverlayOpen = <State extends MetaOverlayExecutorState>(
    pointer: MetaOverlayReturnPointer,
    transitionAction: StoreNavigationAction,
    deps: MetaOverlayExecutorDeps<State>,
    requestedReturnView?: SubscreenReturnView
): void => {
    const { run } = deps.getState();
    const transition = resolveNavigationTransition(deps.getState(), transitionAction, requestedReturnView);
    const result = createMetaOverlayOpenSurfaceResult({
        freezeRun: deps.freezeRunSnapshotForPlayingMetaOverlay,
        pointer,
        run,
        transition
    });

    if (result.kind === 'ignored') {
        return;
    }

    if (result.kind === 'freeze') {
        deps.clearAllTimers();
    }

    deps.setState(result.patch as Partial<State>);
};

export const executeMetaOverlayClose = <State extends MetaOverlayExecutorState>(
    pointer: MetaOverlayReturnPointer,
    transitionAction: 'closeSettings' | 'closeSubscreen',
    deps: MetaOverlayExecutorDeps<State>
): void => {
    const { run } = deps.getState();
    const transition = resolveNavigationTransition(deps.getState(), transitionAction);
    const nextRun = transition.resumeRun && run?.status === 'paused' ? deps.resumeRunWithTimers(run) : run;
    const result = createMetaOverlayCloseSurfaceResult({
        pointer,
        run: nextRun,
        transition
    });

    if (result.kind === 'gameOver') {
        deps.applyResolvedRun(result.run);
        deps.setState(result.patch as Partial<State>);
        return;
    }

    deps.setState(result.patch as MetaOverlayStatePatch as Partial<State>);
};
