import type { RunState, ViewState } from '../../shared/contracts';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';
import { clearRunSurfaceArmedModes, type RunSurfaceState } from './runSurfaceState';
import {
    getNewGameplayFeedback,
    type GameplayFeedbackPresentation
} from './gameplayFeedbackAdapter';

type SideRoomResultSurfacePatch =
    | {
          run: RunState;
          view: 'playing';
      }
    | {
          boardPinMode: RunSurfaceState['boardPinMode'];
          destroyPairArmed: RunSurfaceState['destroyPairArmed'];
          matchScorePop: RunSurfaceState['matchScorePop'];
          mismatchScorePop: RunSurfaceState['mismatchScorePop'];
          peekModeArmed: RunSurfaceState['peekModeArmed'];
          tileSwapArmed: RunSurfaceState['tileSwapArmed'];
          tileSwapFirstTileId: RunSurfaceState['tileSwapFirstTileId'];
          run: RunState;
          shopReturnMode: 'summary';
          view: 'shop';
      };

export const createSideRoomResultSurfacePatch = (run: RunState): SideRoomResultSurfacePatch => {
    if (run.shopOffers.length > 0) {
        return {
            run,
            view: 'shop',
            shopReturnMode: 'summary',
            ...clearRunSurfaceArmedModes(),
            ...BOARD_FLOATER_POP_CLEAR
        };
    }

    return { run, view: 'playing' };
};

export const shouldContinueAfterSideRoomResult = (patch: SideRoomResultSurfacePatch): boolean =>
    patch.view === 'playing';

type SideRoomActionSurfaceResult =
    | {
          kind: 'ignored';
      }
    | {
          kind: 'menu';
          patch: {
              view: 'menu';
          };
      }
    | {
          kind: 'playing';
          patch: {
              view: 'playing';
          };
      }
    | {
          kind: 'gameOver';
          run: RunState;
      }
    | {
          continueAfterPatch: boolean;
          feedback: GameplayFeedbackPresentation | null;
          kind: 'applied';
          patch: SideRoomResultSurfacePatch;
      };

export type SideRoomActionSurfacePatch = Extract<SideRoomActionSurfaceResult, { patch: unknown }>['patch'];

export const createDeadInterludeGameOverRun = (run: RunState): RunState | null => {
    if (run.status !== 'gameOver' && run.lives > 0) {
        return null;
    }

    return {
        ...run,
        status: 'gameOver',
        lives: 0,
        pendingRouteCardPlan: null,
        sideRoom: null,
        relicOffer: null,
        shopOffers: []
    };
};

export const createSideRoomActionSurfaceResult = (
    view: ViewState,
    run: RunState | null,
    applyAction: (run: RunState) => RunState
): SideRoomActionSurfaceResult => {
    if (view !== 'sideRoom') {
        return { kind: 'ignored' };
    }

    if (!run) {
        return { kind: 'menu', patch: { view: 'menu' } };
    }

    const gameOverRun = createDeadInterludeGameOverRun(run);
    if (gameOverRun) {
        return { kind: 'gameOver', run: gameOverRun };
    }

    if (run.status !== 'levelComplete' || !run.sideRoom) {
        return { kind: 'playing', patch: { view: 'playing' } };
    }

    const nextRun = applyAction(run);
    if (nextRun === run) {
        return { kind: 'ignored' };
    }

    const patch = createSideRoomResultSurfacePatch(nextRun);
    return {
        continueAfterPatch: shouldContinueAfterSideRoomResult(patch),
        feedback: getNewGameplayFeedback(run, nextRun).find((item) => item.audioCategory === 'reward-claim') ?? null,
        kind: 'applied',
        patch
    };
};
