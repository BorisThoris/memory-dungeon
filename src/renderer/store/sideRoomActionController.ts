import type { RunState, ViewState } from '../../shared/contracts';
import { createSideRoomActionSurfaceResult } from './sideRoomSurfaceState';

interface SideRoomActionControllerState {
    run: RunState | null;
    view: ViewState;
}

interface SideRoomActionControllerDeps<TState extends SideRoomActionControllerState> {
    applyResolvedRun: (run: RunState) => void;
    continueToNextLevel: () => void;
    getState: () => TState;
    setState: (patch: Partial<TState>) => void;
}

interface SideRoomActionController {
    applySideRoomAction: (applyAction: (run: RunState) => RunState) => void;
}

export const createSideRoomActionController = <TState extends SideRoomActionControllerState>({
    applyResolvedRun,
    continueToNextLevel,
    getState,
    setState
}: SideRoomActionControllerDeps<TState>): SideRoomActionController => ({
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
        setState(result.patch as Partial<TState>);
        if (result.kind === 'applied' && result.continueAfterPatch) {
            continueToNextLevel();
        }
    }
});
