import type { RunState, SubscreenReturnView, ViewState } from '../../shared/contracts';
import type { StoreNavigationTransition } from './navigationModel';

export type MetaOverlayReturnPointer = 'settingsReturnView' | 'subscreenReturnView';

export type MetaOverlayStatePatch = {
    view: ViewState;
    run?: RunState | null;
    settingsReturnView?: SubscreenReturnView;
    subscreenReturnView?: SubscreenReturnView;
};

type MetaOverlayPointerResetPatch = Pick<MetaOverlayStatePatch, MetaOverlayReturnPointer>;

type MetaOverlayCloseSurfaceResult =
    | {
          kind: 'gameOver';
          patch: MetaOverlayPointerResetPatch;
          run: RunState;
      }
    | {
          kind: 'close';
          patch: MetaOverlayStatePatch;
      }
    | {
          kind: 'navigate';
          patch: MetaOverlayStatePatch;
      };

type MetaOverlayOpenSurfaceResult =
    | {
          kind: 'freeze';
          patch: MetaOverlayStatePatch;
      }
    | {
          kind: 'navigate';
          patch: MetaOverlayStatePatch;
      }
    | {
          kind: 'ignored';
      };

const isSubscreenReturnView = (view: ViewState): view is SubscreenReturnView =>
    view !== 'boot' && view !== 'settings';

const transitionReturnView = (
    transition: StoreNavigationTransition,
    pointer: MetaOverlayReturnPointer
): SubscreenReturnView => {
    const explicitReturnView =
        pointer === 'settingsReturnView'
            ? transition.settingsReturnView
            : transition.subscreenReturnView;

    if (explicitReturnView) {
        return explicitReturnView;
    }

    return isSubscreenReturnView(transition.view) ? transition.view : 'menu';
};

export const createFrozenMetaOverlayPatch = (
    transition: StoreNavigationTransition,
    pointer: MetaOverlayReturnPointer,
    run: RunState
): MetaOverlayStatePatch => ({
    view: transition.view,
    [pointer]: transitionReturnView(transition, pointer),
    run
});

export const createMetaOverlayClosePatch = (
    transition: StoreNavigationTransition,
    pointer: MetaOverlayReturnPointer,
    run: RunState | null | undefined
): MetaOverlayStatePatch => ({
    view: transition.view,
    [pointer]: transitionReturnView(transition, pointer),
    run: run ?? null
});

export const createMetaOverlayNavigationPatch = (
    transition: StoreNavigationTransition,
    pointer: MetaOverlayReturnPointer
): MetaOverlayStatePatch => ({
    view: transition.view,
    [pointer]: transitionReturnView(transition, pointer)
});

export const createMetaOverlayPointerResetPatch = (
    pointer: MetaOverlayReturnPointer
): MetaOverlayPointerResetPatch => ({
    [pointer]: 'menu'
});

export const createMetaOverlayCloseSurfaceResult = ({
    pointer,
    run,
    transition
}: {
    pointer: MetaOverlayReturnPointer;
    run: RunState | null | undefined;
    transition: StoreNavigationTransition;
}): MetaOverlayCloseSurfaceResult => {
    if (transition.resumeRun) {
        if (run?.status === 'gameOver') {
            return {
                kind: 'gameOver',
                patch: createMetaOverlayPointerResetPatch(pointer),
                run
            };
        }

        return {
            kind: 'close',
            patch: createMetaOverlayClosePatch(transition, pointer, run)
        };
    }

    return {
        kind: 'navigate',
        patch: createMetaOverlayNavigationPatch(transition, pointer)
    };
};

export const createMetaOverlayOpenSurfaceResult = ({
    freezeRun,
    pointer,
    run,
    transition
}: {
    freezeRun: (run: RunState) => RunState;
    pointer: MetaOverlayReturnPointer;
    run: RunState | null | undefined;
    transition: StoreNavigationTransition;
}): MetaOverlayOpenSurfaceResult => {
    if (transition.freezeRun) {
        if (!run) {
            return { kind: 'ignored' };
        }

        return {
            kind: 'freeze',
            patch: createFrozenMetaOverlayPatch(transition, pointer, freezeRun(run))
        };
    }

    return {
        kind: 'navigate',
        patch: createMetaOverlayNavigationPatch(transition, pointer)
    };
};
