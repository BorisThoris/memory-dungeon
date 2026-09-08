import type { RunState, SaveData, Settings } from '../../shared/contracts';
import { createDungeonShowcaseRun, createNewRun, createWildRun } from '../../shared/game-core';
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
    return {
        mode: run.gameMode,
        practice: run.practiceMode,
        ...extra
    };
};

/*
 * The one meta option a save used to carry into a run was the relic shrine's extra pick; the
 * draft went in Gen 175, so a save carries nothing into run creation now.
 */
const metaRelicOptionsForSave = (_saveData: SaveData): Record<string, never> => ({});

export type RunStartRequest =
    | { kind: 'endless'; setup?: ClassicRunSetup }
    | { kind: 'passAndPlay'; seats: number }
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
        case 'endless': {
            /*
             * The one mode, and the only place the old preset cards now live. Gauntlet's timer,
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
            ...(previousRun?.activeContract ? { activeContract: previousRun.activeContract } : {})
        });
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
