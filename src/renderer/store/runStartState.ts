import type { MutatorId, RunState, SaveData, Settings } from '../../shared/contracts';
import { BUILTIN_PUZZLES } from '../../shared/builtin-puzzles';
import {
    createDailyRun,
    createDungeonShowcaseRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun
} from '../../shared/game-core';
import { metaRelicDraftExtraPerMilestoneFromSave } from '../../shared/save-data';
import { patchRunFromUserSettings } from './runSettingsPatch';
import { createRunSurfaceReset, type RunSurfaceState } from './runSurfaceState';

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
    extra: RunStartTelemetryExtra = {}
): RunStartTelemetryExtra => ({
    mode: run.gameMode,
    practice: run.practiceMode,
    ...extra
});

const metaRelicOptionsForSave = (saveData: SaveData) => ({
    metaRelicDraftExtraPerMilestone: metaRelicDraftExtraPerMilestoneFromSave(saveData)
});

export type RunStartRequest =
    | { kind: 'daily' }
    | { kind: 'dungeonShowcase' }
    | { kind: 'endless' }
    | { durationMs: number; kind: 'gauntlet' }
    | { kind: 'meditation' }
    | { kind: 'meditationWithMutators'; mutators: MutatorId[] }
    | { kind: 'pinVow' }
    | { kind: 'practice' }
    | { kind: 'puzzle'; puzzleId: string }
    | { kind: 'scholarContract' }
    | { kind: 'wild' };

export interface RunStartPlan {
    patch: RunStartStatePatch;
    run: RunState;
    telemetry: RunStartTelemetryExtra;
}

export const createRunStartPlan = ({
    request,
    saveData,
    settings
}: {
    request: RunStartRequest;
    saveData: SaveData;
    settings: Settings;
}): RunStartPlan | null => {
    const bestScore = saveData.bestScore;
    const meta = metaRelicOptionsForSave(saveData);
    let run: RunState;
    let telemetryExtra: RunStartTelemetryExtra = {};

    switch (request.kind) {
        case 'daily':
            run = createDailyRun(bestScore, meta);
            break;
        case 'dungeonShowcase':
            run = createDungeonShowcaseRun(bestScore, meta);
            telemetryExtra = { showcase: 'dungeon' };
            break;
        case 'endless':
            run = createNewRun(bestScore, {
                ...meta,
                onboardingSafeFirstFloor: !saveData.onboardingDismissed
            });
            break;
        case 'gauntlet':
            run = createGauntletRun(bestScore, request.durationMs, meta);
            break;
        case 'meditation':
            run = createMeditationRun(bestScore, undefined, meta);
            break;
        case 'meditationWithMutators':
            run = createMeditationRun(bestScore, request.mutators, meta);
            telemetryExtra = {
                meditation_focus_count: request.mutators.length,
                meditation_focus: request.mutators.length > 0 ? request.mutators.join(',') : undefined
            };
            break;
        case 'pinVow':
            run = createNewRun(bestScore, {
                ...meta,
                activeContract: { noShuffle: false, noDestroy: false, maxMismatches: null, maxPinsTotalRun: 10 }
            });
            telemetryExtra = { pinVow: true };
            break;
        case 'practice':
            run = createNewRun(bestScore, { practiceMode: true, ...meta });
            break;
        case 'puzzle': {
            const puzzle = BUILTIN_PUZZLES[request.puzzleId];
            if (!puzzle) {
                return null;
            }
            run = createPuzzleRun(bestScore, puzzle.id, puzzle.tiles, 1, meta);
            telemetryExtra = { puzzleId: puzzle.id };
            break;
        }
        case 'scholarContract':
            run = createNewRun(bestScore, {
                ...meta,
                activeContract: {
                    noShuffle: true,
                    noDestroy: true,
                    maxMismatches: null,
                    bonusRelicDraftPick: true
                }
            });
            telemetryExtra = { scholar: true };
            break;
        case 'wild':
            run = createWildRun(bestScore, meta);
            telemetryExtra = { wild: true };
            break;
    }

    const patchedRun = patchRunFromUserSettings(run, settings);
    return {
        patch: createRunStartStatePatch(patchedRun, saveData),
        run: patchedRun,
        telemetry: createRunStartTelemetryPayload(patchedRun, telemetryExtra)
    };
};

export const isDungeonShowcaseRestartRun = (run: RunState | null): boolean =>
    run?.dungeonShowcaseRun === true || run?.lastRunSummary?.dungeonShowcaseRun === true;

export const createRestartRun = (previousRun: RunState | null, saveData: SaveData): RunState => {
    const bestScore = saveData.bestScore;
    const meta = metaRelicOptionsForSave(saveData);

    if (isDungeonShowcaseRestartRun(previousRun)) {
        return createDungeonShowcaseRun(bestScore, meta);
    }

    if (previousRun?.gameMode === 'daily') {
        return createDailyRun(bestScore, meta);
    }

    if (previousRun?.gameMode === 'gauntlet') {
        return createGauntletRun(bestScore, previousRun.gauntletSessionDurationMs ?? 10 * 60 * 1000, meta);
    }

    if (previousRun?.gameMode === 'puzzle' && previousRun.puzzleId) {
        const puzzle = BUILTIN_PUZZLES[previousRun.puzzleId];
        return puzzle ? createPuzzleRun(bestScore, puzzle.id, puzzle.tiles, 1, meta) : createNewRun(bestScore, meta);
    }

    if (previousRun?.gameMode === 'meditation') {
        return createMeditationRun(
            bestScore,
            previousRun.activeMutators.length > 0 ? previousRun.activeMutators : undefined,
            meta
        );
    }

    if (previousRun?.activeContract?.maxPinsTotalRun != null) {
        return createNewRun(bestScore, { ...meta, activeContract: previousRun.activeContract });
    }

    if (previousRun?.wildMenuRun) {
        return createWildRun(bestScore, meta);
    }

    if (previousRun?.practiceMode) {
        return createNewRun(bestScore, { practiceMode: true, ...meta });
    }

    if (previousRun?.activeContract?.noShuffle && previousRun.activeContract.noDestroy) {
        return createNewRun(bestScore, {
            ...meta,
            activeContract: previousRun.activeContract
        });
    }

    return createNewRun(bestScore, {
        ...meta,
        onboardingSafeFirstFloor: !saveData.onboardingDismissed
    });
};
