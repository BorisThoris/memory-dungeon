import type { RunState, SaveData, Settings } from '../../shared/contracts';
import { enableDebugPeek } from '../../shared/run-timer-rules';
import { trackEvent } from '../../shared/telemetry';
import { patchRunFromUserSettings } from './runSettingsPatch';
import {
    createRestartRun,
    createRunStartStatePatch,
    createRunStartTelemetryPayload
} from './runStartState';
import { createRunSurfaceReset } from './runSurfaceState';

interface RunLifecycleControllerState {
    run: RunState | null;
    saveData: SaveData;
    settings: Settings;
}

interface RunLifecycleControllerDeps<TState extends RunLifecycleControllerState> {
    clearAllTimers: () => void;
    getState: () => TState;
    playRunStartSfx: () => void;
    prepareMemorizeTimerForBoardReady: (run: RunState) => void;
    scheduleDebugRevealTimer: (durationMs: number) => void;
    setState: (patch: Partial<TState>) => void;
}

export interface RunLifecycleController {
    endRun: () => void;
    restartRun: () => void;
    triggerDebugReveal: () => void;
}

export const createRunLifecycleController = <TState extends RunLifecycleControllerState>({
    clearAllTimers,
    getState,
    playRunStartSfx,
    prepareMemorizeTimerForBoardReady,
    scheduleDebugRevealTimer,
    setState
}: RunLifecycleControllerDeps<TState>): RunLifecycleController => ({
    endRun: () => {
        clearAllTimers();
        const patch = {
            view: 'menu',
            run: null,
            runStartSaveData: null,
            newlyUnlockedAchievements: [],
            subscreenReturnView: 'menu',
            settingsReturnView: 'menu',
            ...createRunSurfaceReset()
        };
        setState(patch as unknown as Partial<TState>);
    },

    restartRun: () => {
        clearAllTimers();
        const { run: previousRun, saveData, settings } = getState();
        const run = patchRunFromUserSettings(createRestartRun(previousRun, saveData), settings);

        trackEvent('run_start', createRunStartTelemetryPayload(run, { restarted: true }));
        playRunStartSfx();

        setState(createRunStartStatePatch(run, saveData) as unknown as Partial<TState>);
        prepareMemorizeTimerForBoardReady(run);
    },

    triggerDebugReveal: () => {
        const { run, settings } = getState();

        if (!run || run.status !== 'playing' || !settings.debugFlags.allowBoardReveal) {
            return;
        }

        const nextRun = enableDebugPeek(run, settings.debugFlags.disableAchievementsOnDebug);

        setState({ run: nextRun } as Partial<TState>);

        if (nextRun.timerState.debugRevealRemainingMs !== null) {
            scheduleDebugRevealTimer(nextRun.timerState.debugRevealRemainingMs);
        }
    }
});
