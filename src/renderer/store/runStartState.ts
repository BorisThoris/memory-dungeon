import type { RunState, SaveData, Settings } from '../../shared/contracts';
import { getBuiltinPuzzle } from '../../shared/builtin-puzzles';
import {
    createDailyRun,
    createDungeonShowcaseRun,
    createGauntletRun,
    createMeditationRun,
    createNewRun,
    createPuzzleRun,
    createWildRun
} from '../../shared/game-core';
import { createRunFromShareKey } from '../../shared/run-from-share-key';
import {
    buildClassicRunOptions,
    DEFAULT_CLASSIC_RUN_SETUP,
    describeClassicRunSetup,
    classicRunSetupFromRun,
    isDefaultClassicRunSetup,
    type ClassicRunSetup
} from '../../shared/classic-run-setup';
import type { RunShareKey } from '../../shared/run-share-key';
import { metaRelicDraftExtraPerMilestoneFromSave } from '../../shared/save-data';
import { applyRunSettings } from '../../shared/run-settings-rules';
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
): RunStartTelemetryExtra => {
    const startingLoadout = run.startingLoadoutId ? { startingLoadout: run.startingLoadoutId } : {};
    return {
        mode: run.gameMode,
        practice: run.practiceMode,
        ...startingLoadout,
        ...extra
    };
};

const metaRelicOptionsForSave = (saveData: SaveData) => ({
    metaRelicDraftExtraPerMilestone: metaRelicDraftExtraPerMilestoneFromSave(saveData)
});

export type RunStartRequest =
    | { kind: 'daily' }
    | { kind: 'endless'; setup?: ClassicRunSetup }
    | { kind: 'passAndPlay'; seats: number }
    | { kind: 'puzzle'; puzzleId: string }
    | { key: RunShareKey; kind: 'shared' };

interface RunStartPlan {
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
        case 'endless': {
            /*
             * The main run, and the only place the old preset cards now live. Gauntlet's timer,
             * Wild's joker, Scholar's and Pin Vow's contracts, Practice's unrecorded flag and
             * Meditation's pacing are all `createNewRun` options, so they arrive here as a setup
             * the player chose rather than as separate menu entries that started the same run.
             */
            const setup = request.setup ?? DEFAULT_CLASSIC_RUN_SETUP;
            run = createNewRun(bestScore, {
                ...meta,
                ...buildClassicRunOptions(setup),
                // The safe first floor is for someone's first run, not for someone who has just
                // asked for a timed chaos descent under a vow.
                onboardingSafeFirstFloor: !saveData.onboardingDismissed && isDefaultClassicRunSetup(setup)
            });
            telemetryExtra = {
                setup: describeClassicRunSetup(setup).join(',') || undefined
            };
            break;
        }
        case 'passAndPlay':
            /*
             * The same endless ruleset every solo run uses; only the credit is split. It skips the
             * onboarding-safe first floor because a table sitting down together is not a first run.
             */
            run = createNewRun(bestScore, { ...meta, passAndPlaySeats: request.seats });
            telemetryExtra = { passAndPlaySeats: request.seats };
            break;
        case 'puzzle': {
            const puzzle = getBuiltinPuzzle(request.puzzleId);
            if (!puzzle) {
                return null;
            }
            run = createPuzzleRun(bestScore, puzzle.id, puzzle.tiles, 1, meta);
            telemetryExtra = { puzzleId: puzzle.id };
            break;
        }
        case 'shared': {
            run = createRunFromShareKey(request.key, bestScore, meta);
            break;
        }
    }

    const patchedRun = applyRunSettings(run, settings);
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
    const startingLoadoutId = previousRun?.startingLoadoutId ?? null;

    /*
     * A table that just finished wants another game, not a solo run. Restart is a separate path
     * from the start plan, so a mode that forgets itself here quietly hands the device to one
     * player mid-evening.
     */
    if (previousRun?.passAndPlay) {
        return createNewRun(bestScore, { ...meta, passAndPlaySeats: previousRun.passAndPlay.seats.length });
    }

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
        const puzzle = getBuiltinPuzzle(previousRun.puzzleId);
        return puzzle ? createPuzzleRun(bestScore, puzzle.id, puzzle.tiles, 1, meta) : createNewRun(bestScore, meta);
    }

    if (previousRun?.gameMode === 'meditation') {
        return createMeditationRun(
            bestScore,
            previousRun.activeMutators.length > 0 ? previousRun.activeMutators : undefined,
            meta
        );
    }

    /*
     * A Classic run started from the setup sheet is several choices at once — a clock, a pace,
     * vows, the joker, the record toggle — and the one-flag branches below each restart one of
     * them and forget the rest. Read the whole setup back off the run and restart all of it.
     */
    const setup = previousRun ? classicRunSetupFromRun(previousRun) : null;
    if (setup && !isDefaultClassicRunSetup(setup)) {
        return createNewRun(bestScore, {
            ...meta,
            ...buildClassicRunOptions(setup),
            // The contract object itself carries on: a mismatch cap the sheet does not offer survives.
            ...(previousRun?.activeContract ? { activeContract: previousRun.activeContract } : {}),
            startingLoadoutId
        });
    }

    if (previousRun?.activeContract?.maxPinsTotalRun != null) {
        return createNewRun(bestScore, { ...meta, activeContract: previousRun.activeContract, startingLoadoutId });
    }

    if (previousRun?.wildMenuRun) {
        return createWildRun(bestScore, meta);
    }

    if (previousRun?.practiceMode) {
        return createNewRun(bestScore, { practiceMode: true, ...meta, startingLoadoutId });
    }

    if (previousRun?.activeContract?.noShuffle && previousRun.activeContract.noDestroy) {
        return createNewRun(bestScore, {
            ...meta,
            activeContract: previousRun.activeContract,
            startingLoadoutId
        });
    }

    return createNewRun(bestScore, {
        ...meta,
        startingLoadoutId,
        onboardingSafeFirstFloor: !saveData.onboardingDismissed
    });
};
