import type {
    AchievementId,
    RunState,
    SaveData,
    Settings,
    SubscreenReturnView,
    ViewState
} from '../../shared/contracts';
import { activateDebugRevealThroughGameplayCore } from '../../shared/gameplay-core-adapters';
import { applyRunSettings } from '../../shared/run-settings-rules';
import { trackEvent } from '../../shared/telemetry';
import {
    createRestartRun,
    createRunStartStatePatch,
    createRunStartTelemetryPayload
} from './runStartState';
import { createRunSurfaceReset, type RunSurfaceState } from './runSurfaceState';

interface RunLifecycleControllerState {
    run: RunState | null;
    saveData: SaveData;
    settings: Settings;
}

interface RunLifecycleMutableState extends RunSurfaceState {
    newlyUnlockedAchievements: AchievementId[];
    run: RunState | null;
    runStartSaveData: SaveData | null;
    settingsReturnView: SubscreenReturnView;
    subscreenReturnView: SubscreenReturnView;
    view: ViewState;
}

interface RunLifecycleControllerDeps {
    clearAllTimers: () => void;
    getState: () => RunLifecycleControllerState;
    playRunStartSfx: () => void;
    prepareMemorizeTimerForBoardReady: (run: RunState) => void;
    scheduleDebugRevealTimer: (durationMs: number) => void;
    setState: (patch: Partial<RunLifecycleMutableState>) => void;
}

interface RunLifecycleController {
    endRun: () => void;
    restartRun: () => void;
    triggerDebugReveal: () => void;
}

export const createRunLifecycleController = ({
    clearAllTimers,
    getState,
    playRunStartSfx,
    prepareMemorizeTimerForBoardReady,
    scheduleDebugRevealTimer,
    setState
}: RunLifecycleControllerDeps): RunLifecycleController => ({
    endRun: () => {
        clearAllTimers();
        const patch: Partial<RunLifecycleMutableState> = {
            view: 'menu',
            run: null,
            runStartSaveData: null,
            newlyUnlockedAchievements: [],
            subscreenReturnView: 'menu',
            settingsReturnView: 'menu',
            ...createRunSurfaceReset()
        };
        setState(patch);
    },

    restartRun: () => {
        clearAllTimers();
        const { run: previousRun, saveData, settings } = getState();
        const run = applyRunSettings(createRestartRun(previousRun, saveData), settings);

        trackEvent('run_start', createRunStartTelemetryPayload(run, { restarted: true }));
        playRunStartSfx();

        setState(createRunStartStatePatch(run, saveData));
        prepareMemorizeTimerForBoardReady(run);
    },

    triggerDebugReveal: () => {
        const { run, settings } = getState();

        if (!run || run.status !== 'playing' || !settings.debugFlags.allowBoardReveal) {
            return;
        }

        const commandJournalLength = Array.isArray(run.gameplayCommandJournal)
            ? run.gameplayCommandJournal.length
            : 0;
        const nextRun = activateDebugRevealThroughGameplayCore(
            run,
            settings.debugFlags.disableAchievementsOnDebug,
            `debug-reveal-activate:${run.runSeed}:${commandJournalLength}`
        ).run;

        setState({ run: nextRun });

        if (nextRun.timerState.debugRevealRemainingMs !== null) {
            scheduleDebugRevealTimer(nextRun.timerState.debugRevealRemainingMs);
        }
    }
});
