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

export interface ShopCloseExecutorDeps<State extends ShopCloseExecutorState> {
    applyResolvedRun: (run: RunState) => void;
    continueToNextLevel?: () => void;
    getState: () => State;
    resumeRunWithTimers: (run: RunState) => RunState;
    setState: (patch: Partial<State>) => void;
}

export const executeShopCloseToFloorSummary = <State extends ShopCloseExecutorState>(
    deps: ShopCloseExecutorDeps<State>
): void => {
    const state = deps.getState();
    const transition = resolveNavigationTransition(state, 'closeShopToFloorSummary' satisfies StoreNavigationAction);
    const nextRun = shouldResumeShopRunOnClose(state.shopReturnMode, state.run)
        ? deps.resumeRunWithTimers(state.run)
        : state.run;
    const result = createShopCloseSurfaceResult(transition, nextRun);

    if (result.kind === 'gameOver') {
        deps.applyResolvedRun(result.run);
        deps.setState(result.patch as Partial<State>);
        return;
    }

    deps.setState(result.patch as Partial<State>);
};

export const executeContinueFromShop = <State extends ShopCloseExecutorState>(
    deps: ShopCloseExecutorDeps<State> & { continueToNextLevel: () => void }
): void => {
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
            deps.setState(result.patch as Partial<State>);
            return;
        }

        deps.setState(result.patch as Partial<State>);
        return;
    }

    deps.setState(createShopReturnModeResetPatch() as Partial<State>);
    deps.continueToNextLevel();
};
