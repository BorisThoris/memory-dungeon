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
    setState: (patch: SideRoomActionSurfacePatch) => void;
}

interface SideRoomActionController {
    applySideRoomAction: (applyAction: (run: RunState) => RunState) => void;
}

export const createSideRoomActionController = ({
    applyResolvedRun,
    continueToNextLevel,
    getState,
    setState
}: SideRoomActionControllerDeps): SideRoomActionController => ({
    applySideRoomAction: (applyAction) => {
        const { run, view } = getState();
        const result = createSideRoomActionSurfaceResult(view, run, applyAction);
        if (result.kind === 'ignored') {
            return;
        }
        if (result.kind === 'gameOver') {
            applyResolvedRun(result.run);
            return;
        }
        setState(result.patch);
        if (result.kind === 'applied' && result.continueAfterPatch) {
            continueToNextLevel();
        }
    }
});
