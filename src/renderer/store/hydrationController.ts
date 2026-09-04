import type { DesktopApi, SaveData, Settings } from '../../shared/contracts';
import { normalizeUnknownSteamConnected } from '../../shared/desktop-api-boundary';
import { mergeHonorUnlockTags } from '../../shared/honorUnlocks';
import { createDefaultSaveData, normalizeUnknownSaveData } from '../../shared/save-data';
import { describeCrashReports, normalizeCrashReportSummary } from '../../shared/crash-report-summary';
import { runPersistenceInBackground } from './backgroundPersistence';

export const SAVE_READ_FAILURE_NOTICE =
    'Save read failed. Started a temporary in-memory profile and paused autosave to avoid overwriting recoverable data.';

/** Shown when the way out of a read failure itself fails; the old save is still untouched. */
export const SAVE_RECOVERY_FAILED_NOTICE =
    'Could not start a fresh profile. Your existing save file has not been changed, and autosave stays paused.';

interface HydratedAppStatePatch {
    hydrated: true;
    hydrating: false;
    priorCrashNotice: string | null;
    saveData: SaveData;
    saveReadFailureNotice: string | null;
    saveWritesBlockedByReadFailure: boolean;
    settings: Settings;
    steamConnected: boolean;
    view: 'menu';
}

interface CreateHydratedAppStatePatchInput {
    desktop: Pick<DesktopApi, 'getSaveData' | 'isSteamConnected'> & Partial<Pick<DesktopApi, 'getCrashReportSummary'>>;
    persistSaveData: (saveData: SaveData) => Promise<SaveData> | SaveData;
}

export const createHydratedAppStatePatch = async ({
    desktop,
    persistSaveData
}: CreateHydratedAppStatePatchInput): Promise<HydratedAppStatePatch> => {
    let saveReadFailed = false;
    const [rawSave, steamConnected, priorCrashNotice] = await Promise.all([
        Promise.resolve()
            .then(() => desktop.getSaveData())
            .then(normalizeUnknownSaveData)
            .catch(() => {
                saveReadFailed = true;
                return createDefaultSaveData();
            }),
        Promise.resolve()
            .then(() => desktop.isSteamConnected())
            .then(normalizeUnknownSteamConnected)
            .catch(() => false),
        // Diagnostics are never worth failing a boot over.
        Promise.resolve()
            .then(() => desktop.getCrashReportSummary?.() ?? null)
            .then((summary) => (summary === null ? null : describeCrashReports(normalizeCrashReportSummary(summary))))
            .catch(() => null)
    ]);

    const saveData = mergeHonorUnlockTags(rawSave);
    if (saveData !== rawSave && !saveReadFailed) {
        runPersistenceInBackground(() => persistSaveData(saveData));
    }

    return {
        hydrating: false,
        hydrated: true,
        steamConnected,
        saveData,
        settings: saveData.settings,
        view: 'menu',
        priorCrashNotice,
        saveReadFailureNotice: saveReadFailed ? SAVE_READ_FAILURE_NOTICE : null,
        saveWritesBlockedByReadFailure: saveReadFailed
    };
};
