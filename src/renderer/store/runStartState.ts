import type { ContractFlags, RunState, SaveData, Settings, StartingLoadoutId } from '../../shared/contracts';
import {
    createRestartRunSelection,
    createRunStartCommand,
    gameplaySettingsForRunStart,
    type RunStartCommand,
    type RunStartRequest
} from '../../shared/run-start-core-contracts';
import { reduceRunStartCommand } from '../../shared/run-start-core';
import type { GameplayEvent } from '../../shared/gameplay-core-contracts';
import { metaRelicDraftExtraPerMilestoneFromSave } from '../../shared/save-data';
import { createRunSurfaceReset, type RunSurfaceState } from './runSurfaceState';
import {
    projectGameplayFeedback,
    type GameplayFeedbackPresentation
} from './gameplayFeedbackAdapter';

export type RunStartTelemetryExtra = Record<string, boolean | number | string | undefined>;

export interface RunStartStatePatch extends RunSurfaceState {
    newlyUnlockedAchievements: [];
    run: RunState;
    runStartSaveData: SaveData;
    view: 'playing';
}

export const createRunStartStatePatch = (run: RunState, saveData: SaveData): RunStartStatePatch => ({
    view: 'playing',
    newlyUnlockedAchievements: [],
    ...createRunSurfaceReset(),
    run,
    runStartSaveData: saveData
});

export const createRunStartTelemetryPayload = (
    run: RunState,
    events: readonly GameplayEvent[] = [],
    extra: RunStartTelemetryExtra = {}
): RunStartTelemetryExtra => {
    const started = events.find(
        (event): event is Extract<GameplayEvent, { type: 'run.started' }> => event.type === 'run.started'
    );
    const startingLoadout = run.startingLoadoutId ? { startingLoadout: run.startingLoadoutId } : {};
    return {
        mode: started?.gameMode ?? run.gameMode,
        practice: started?.practiceMode ?? run.practiceMode,
        ...startingLoadout,
        ...extra
    };
};

interface RunStartPlan {
    command: RunStartCommand;
    events: GameplayEvent[];
    feedback: GameplayFeedbackPresentation | null;
    patch: RunStartStatePatch;
    run: RunState;
    telemetry: RunStartTelemetryExtra;
}

const telemetryExtraForRunStart = (request: RunStartRequest): RunStartTelemetryExtra => {
    switch (request.kind) {
        case 'dungeonShowcase':
            return { showcase: 'dungeon' };
        case 'meditationWithMutators':
            return {
                meditation_focus_count: request.mutators.length,
                meditation_focus: request.mutators.length > 0 ? request.mutators.join(',') : undefined
            };
        case 'pinVow':
            return { pinVow: true };
        case 'puzzle':
            return { puzzleId: request.puzzleId };
        case 'scholarContract':
            return { scholar: true };
        case 'wild':
            return { wild: true };
        default:
            return {};
    }
};

export const createRunStartPlan = ({
    request,
    saveData,
    settings,
    observedAtMs,
    proposedRunSeed,
    reason = 'new',
    activeContractOverride = null,
    startingLoadoutId = null
}: {
    activeContractOverride?: ContractFlags | null;
    request: RunStartRequest;
    saveData: SaveData;
    settings: Settings;
    observedAtMs: number;
    proposedRunSeed: number;
    reason?: RunStartCommand['reason'];
    startingLoadoutId?: StartingLoadoutId | null;
}): RunStartPlan | null => {
    const command = createRunStartCommand({
        activeContractOverride,
        bestScore: saveData.bestScore,
        commandId: `run-start:${reason}:${request.kind}:${proposedRunSeed >>> 0}:${observedAtMs}`,
        metaRelicDraftExtraPerMilestone: metaRelicDraftExtraPerMilestoneFromSave(saveData),
        observedAtMs,
        onboardingDismissed: saveData.onboardingDismissed,
        proposedRunSeed,
        reason,
        request,
        settings: gameplaySettingsForRunStart(settings),
        startingLoadoutId
    });
    const result = reduceRunStartCommand(command);
    if (!result.accepted || !result.run) return null;
    const feedback = projectGameplayFeedback(result.events).find((item) => item.cue === 'run.started') ?? null;
    return {
        command,
        events: result.events,
        feedback,
        patch: createRunStartStatePatch(result.run, saveData),
        run: result.run,
        telemetry: createRunStartTelemetryPayload(result.run, result.events, {
            ...telemetryExtraForRunStart(request),
            ...(reason === 'restart' ? { restarted: true } : {})
        })
    };
};

export const isDungeonShowcaseRestartRun = (run: RunState | null): boolean =>
    createRestartRunSelection(run).request.kind === 'dungeonShowcase';

export { createRestartRunSelection };
export type { RunStartRequest };
