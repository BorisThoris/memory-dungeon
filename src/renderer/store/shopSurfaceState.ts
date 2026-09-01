import type { RunState, ViewState } from '../../shared/contracts';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { createGameplayShopRerollCommand, createGameplayShopPurchaseCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
import type { StoreNavigationTransition } from './navigationModel';
import type { RunSurfaceState } from './runSurfaceState';

type ShopReturnMode = RunSurfaceState['shopReturnMode'];

interface ShopCloseSurfacePatch {
    run: RunState | null;
    shopReturnMode: null;
    view: ViewState;
}

interface ShopReturnModeResetPatch {
    shopReturnMode: null;
}

export interface ShopOpenSurfacePatch {
    shopReturnMode: 'summary';
    view: ViewState;
}

type ShopCloseSurfaceResult =
    | {
          kind: 'gameOver';
          patch: ShopReturnModeResetPatch;
          run: RunState;
      }
    | {
          kind: 'closed';
          patch: ShopCloseSurfacePatch;
      };

type ShopActionSurfaceResult =
    | { kind: 'ignored' }
    | {
          kind: 'applied';
          patch: { run: RunState };
          events?: GameplayEvent[];
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

    const command = createGameplayShopPurchaseCommand(
        `shop-purchase:${run.runSeed}:${run.board?.level ?? 0}:${run.shopRerolls}:${offerId}`,
        offerId
    );
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: appendGameplayJournal(result.run, [command], result.events) },
              events: result.events
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

    // Through the command, matching the purchase path: a reroll spends gold and replaces
    // the stock, so it belongs in the journal like any other shop mutation.
    const command = createGameplayShopRerollCommand(
        `shop-reroll:${run.runSeed}:${run.board?.level ?? 0}:${run.shopRerolls}`
    );
    const result = reduceGameplayCommand(run, command);
    return !result.accepted
        ? { kind: 'ignored' }
        : {
              kind: 'applied',
              patch: { run: appendGameplayJournal(result.run, [command], result.events) },
              events: result.events
          };
};
