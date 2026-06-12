import type {
    RunState,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import {
    resolveNavigationTransition
} from './navigationModel';
import { createDeadInterludeGameOverRun } from './sideRoomSurfaceState';
import {
    canOpenLevelCompleteShopSurface,
    createLevelCompleteShopOpenSurfacePatch,
    type ShopOpenSurfacePatch
} from './shopSurfaceState';

export interface LevelCompleteShopExecutorState {
    run: RunState | null;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}

export interface LevelCompleteShopExecutorDeps<State extends LevelCompleteShopExecutorState> {
    applyResolvedRun: (run: RunState) => void;
    getState: () => State;
    setState: (patch: Partial<State> | ShopOpenSurfacePatch) => void;
}

export const executeOpenShopFromLevelComplete = <State extends LevelCompleteShopExecutorState>(
    deps: LevelCompleteShopExecutorDeps<State>
): void => {
    const { run, view } = deps.getState();
    if (run && view === 'playing' && run.status === 'levelComplete' && run.lives <= 0) {
        const gameOverRun = createDeadInterludeGameOverRun(run);
        if (gameOverRun) {
            deps.applyResolvedRun(gameOverRun);
        }
        return;
    }

    if (!canOpenLevelCompleteShopSurface(view, run)) {
        return;
    }

    const transition = resolveNavigationTransition(deps.getState(), 'openShopFromLevelComplete');
    deps.setState(createLevelCompleteShopOpenSurfacePatch(transition));
};
