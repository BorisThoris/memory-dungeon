import type { RunState, ViewState } from '../../shared/contracts';
import { BOARD_FLOATER_POP_CLEAR } from './matchScorePop';
import { clearRunSurfaceArmedModes, type RunSurfaceState } from './runSurfaceState';
import { createGameplaySideRoomResolveCommand } from '../../shared/gameplay-core-contracts';
import { reduceGameplayCommand } from '../../shared/gameplay-core';
import { appendGameplayJournal } from '../../shared/gameplay-journal';
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
    action: 'claim' | 'skip',
    choiceId?: string
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

    const command = createGameplaySideRoomResolveCommand(
        `side-room:${run.runSeed}:${run.sideRoom.id}:${action}:${choiceId ?? 'primary'}`,
        action,
        choiceId
    );
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        return { kind: 'ignored' };
    }
    const nextRun = appendGameplayJournal(result.run, [command], result.events);

    const patch = createSideRoomResultSurfacePatch(nextRun);
    const feedback = getNewGameplayFeedback(run, nextRun).find(
        (item) => item.audioCategory === 'reward-claim' || item.audioCategory === 'side-room'
    ) ?? null;
    return {
        continueAfterPatch: shouldContinueAfterSideRoomResult(patch),
        feedback,
        kind: 'applied',
        patch
    };
};
