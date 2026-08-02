import type { RunState, ViewState } from '../../shared/contracts';
import {
    createSideRoomActionSurfaceResult,
    type SideRoomActionSurfacePatch
} from './sideRoomSurfaceState';

interface SideRoomActionControllerState {
    run: RunState | null;
    view: ViewState;
}

interface SideRoomActionControllerDeps {
    applyResolvedRun: (run: RunState) => void;
    continueToNextLevel: () => void;
    getState: () => SideRoomActionControllerState;
    playRewardClaimFeedback: () => void;
    setState: (patch: SideRoomActionSurfacePatch) => void;
}

interface SideRoomActionController {
    resolveSideRoom: (action: 'claim' | 'skip', choiceId?: string) => void;
}

export const createSideRoomActionController = ({
    applyResolvedRun,
    continueToNextLevel,
    getState,
    playRewardClaimFeedback,
    setState
}: SideRoomActionControllerDeps): SideRoomActionController => ({
    resolveSideRoom: (action, choiceId) => {
        const { run, view } = getState();
        const result = createSideRoomActionSurfaceResult(view, run, action, choiceId);
        if (result.kind === 'ignored') {
            return;
        }
        if (result.kind === 'gameOver') {
            applyResolvedRun(result.run);
            return;
        }
        setState(result.patch);
        if (
            result.kind === 'applied'
            && (result.feedback?.audioCategory === 'reward-claim' || result.feedback?.audioCategory === 'side-room')
        ) {
            playRewardClaimFeedback();
        }
        if (result.kind === 'applied' && result.continueAfterPatch) {
            continueToNextLevel();
        }
    }
});
