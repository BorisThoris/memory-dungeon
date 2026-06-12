import type {
    RunState,
    SaveData,
    Settings
} from '../../shared/contracts';
import {
    createRunStartPlan,
    type RunStartRequest,
    type RunStartStatePatch,
    type RunStartTelemetryExtra
} from './runStartState';

export interface RunStartExecutorState {
    saveData: SaveData;
    settings: Settings;
}

export interface RunStartExecutorDeps {
    clearAllTimers: () => void;
    getState: () => RunStartExecutorState;
    playRunStartSfx: () => void;
    prepareMemorizeTimerForBoardReady: (run: RunState) => void;
    setState: (patch: RunStartStatePatch) => void;
    trackRunStart: (payload: RunStartTelemetryExtra) => void;
}

export const executeRunStartRequest = (
    request: RunStartRequest,
    deps: RunStartExecutorDeps
): void => {
    const { saveData, settings } = deps.getState();
    const plan = createRunStartPlan({ request, saveData, settings });

    if (!plan) {
        return;
    }

    deps.clearAllTimers();
    deps.trackRunStart(plan.telemetry);
    deps.playRunStartSfx();
    deps.setState(plan.patch);
    deps.prepareMemorizeTimerForBoardReady(plan.run);
};
