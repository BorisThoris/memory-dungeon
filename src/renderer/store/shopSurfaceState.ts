import type { RunState, ViewState } from '../../shared/contracts';
import {
    purchaseShopOffer,
    rerollShopOffers
} from '../../shared/shop-rules';
import type { StoreNavigationTransition } from './navigationModel';
import type { RunSurfaceState } from './runSurfaceState';

export type ShopReturnMode = RunSurfaceState['shopReturnMode'];

export interface ShopCloseSurfacePatch {
    run: RunState | null;
    shopReturnMode: null;
    view: ViewState;
}

export interface ShopReturnModeResetPatch {
    shopReturnMode: null;
}

export interface ShopOpenSurfacePatch {
    shopReturnMode: 'summary';
    view: ViewState;
}

export type ShopCloseSurfaceResult =
    | {
          kind: 'gameOver';
          patch: ShopReturnModeResetPatch;
          run: RunState;
      }
    | {
          kind: 'closed';
          patch: ShopCloseSurfacePatch;
      };

export type ShopActionSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: { run: RunState };
      };

export const shouldResumeShopRunOnClose = (
    shopReturnMode: ShopReturnMode,
    run: RunState | null
): run is RunState => shopReturnMode === 'floor' && Boolean(run);

export const canOpenLevelCompleteShopSurface = (view: ViewState, run: RunState | null): run is RunState =>
    Boolean(
        run &&
            view === 'playing' &&
            run.status === 'levelComplete' &&
            run.lives > 0 &&
            !run.relicOffer &&
            !run.sideRoom &&
            run.shopOffers.length > 0
    );

export const canUseShopSurface = (
    view: ViewState,
    run: RunState | null,
    shopReturnMode: ShopReturnMode
): run is RunState => {
    if (view !== 'shop' || !run || run.lives <= 0) {
        return false;
    }

    return (
        run.status === 'levelComplete' ||
        (shopReturnMode === 'floor' && run.status === 'paused' && run.timerState.pausedFromStatus !== null)
    );
};

export const createLevelCompleteShopOpenSurfacePatch = (
    transition: StoreNavigationTransition
): ShopOpenSurfacePatch => ({
    view: transition.view,
    shopReturnMode: 'summary'
});

export const createShopCloseSurfacePatch = (
    transition: StoreNavigationTransition,
    run: RunState | null | undefined
): ShopCloseSurfacePatch => ({
    view: transition.view,
    run: run ?? null,
    shopReturnMode: null
});

export const createShopReturnModeResetPatch = (): ShopReturnModeResetPatch => ({
    shopReturnMode: null
});

export const createShopCloseSurfaceResult = (
    transition: StoreNavigationTransition,
    run: RunState | null | undefined
): ShopCloseSurfaceResult =>
    run?.status === 'gameOver'
        ? {
              kind: 'gameOver',
              patch: createShopReturnModeResetPatch(),
              run
          }
        : {
              kind: 'closed',
              patch: createShopCloseSurfacePatch(transition, run)
          };

export const createShopPurchaseSurfaceResult = ({
    offerId,
    run,
    shopReturnMode,
    view
}: {
    offerId: string;
    run: RunState | null;
    shopReturnMode: ShopReturnMode;
    view: ViewState;
}): ShopActionSurfaceResult => {
    if (!canUseShopSurface(view, run, shopReturnMode)) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            run: purchaseShopOffer(run, offerId)
        }
    };
};

export const createShopRerollSurfaceResult = ({
    run,
    shopReturnMode,
    view
}: {
    run: RunState | null;
    shopReturnMode: ShopReturnMode;
    view: ViewState;
}): ShopActionSurfaceResult => {
    if (!canUseShopSurface(view, run, shopReturnMode)) {
        return { kind: 'ignored' };
    }

    return {
        kind: 'applied',
        patch: {
            run: rerollShopOffers(run)
        }
    };
};
