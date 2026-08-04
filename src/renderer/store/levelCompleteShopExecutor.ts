import type {
    RunState,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import { resolveInterludeTerminalThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import {
    resolveNavigationTransition
} from './navigationModel';
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

export interface LevelCompleteShopExecutorDeps {
    applyResolvedRun: (run: RunState) => void;
    getState: () => LevelCompleteShopExecutorState;
    setState: (patch: ShopOpenSurfacePatch) => void;
}

export const executeOpenShopFromLevelComplete = (deps: LevelCompleteShopExecutorDeps): void => {
    const { run, view } = deps.getState();
    if (run && view === 'playing' && run.status === 'levelComplete' && run.lives <= 0) {
        const terminal = resolveInterludeTerminalThroughGameplayCore(
            run,
            `interlude-terminal:${run.runSeed}:${run.board?.level ?? 0}:shop:${Array.isArray(run.gameplayCommandJournal) ? run.gameplayCommandJournal.length : 0}`
        );
        if (terminal.accepted) {
            deps.applyResolvedRun(terminal.run);
        }
        return;
    }

    if (!canOpenLevelCompleteShopSurface(view, run)) {
        return;
    }

    const transition = resolveNavigationTransition(deps.getState(), 'openShopFromLevelComplete');
    deps.setState(createLevelCompleteShopOpenSurfacePatch(transition));
};
