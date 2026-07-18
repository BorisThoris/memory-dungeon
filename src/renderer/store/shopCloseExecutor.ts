import type {
    RunState,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import { resolveNavigationTransition, type StoreNavigationAction } from './navigationModel';
import {
    createShopCloseSurfaceResult,
    createShopReturnModeResetPatch,
    shouldResumeShopRunOnClose
} from './shopSurfaceState';

export interface ShopCloseExecutorState {
    run: RunState | null;
    settingsReturnView: SubscreenReturnView;
    shopReturnMode: 'floor' | 'summary' | null;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}

export interface ShopCloseExecutorDeps {
    applyResolvedRun: (run: RunState) => void;
    continueToNextLevel?: () => void;
    getState: () => ShopCloseExecutorState;
    resumeRunWithTimers: (run: RunState) => RunState;
    setState: (patch: Partial<ShopCloseExecutorState>) => void;
}

export type ContinueFromShopExecutorDeps = ShopCloseExecutorDeps & { continueToNextLevel: () => void };

export const executeShopCloseToFloorSummary = (deps: ShopCloseExecutorDeps): void => {
    const state = deps.getState();
    const transition = resolveNavigationTransition(state, 'closeShopToFloorSummary' satisfies StoreNavigationAction);
    const nextRun = shouldResumeShopRunOnClose(state.shopReturnMode, state.run)
        ? deps.resumeRunWithTimers(state.run)
        : state.run;
    const result = createShopCloseSurfaceResult(transition, nextRun);

    if (result.kind === 'gameOver') {
        deps.applyResolvedRun(result.run);
        deps.setState(result.patch);
        return;
    }

    deps.setState(result.patch);
};

export const executeContinueFromShop = (deps: ContinueFromShopExecutorDeps): void => {
    const state = deps.getState();
    if (state.shopReturnMode === 'floor') {
        executeShopCloseToFloorSummary(deps);
        return;
    }

    if (!state.run || state.run.status !== 'levelComplete') {
        const transition = resolveNavigationTransition(state, 'closeShopToFloorSummary' satisfies StoreNavigationAction);
        const result = createShopCloseSurfaceResult(transition, state.run);
        if (result.kind === 'gameOver') {
            deps.applyResolvedRun(result.run);
            deps.setState(result.patch);
            return;
        }

        deps.setState(result.patch);
        return;
    }

    deps.setState(createShopReturnModeResetPatch());
    deps.continueToNextLevel();
};
