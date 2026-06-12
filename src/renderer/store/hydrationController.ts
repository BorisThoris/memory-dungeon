import type { DesktopApi, SaveData, Settings } from '../../shared/contracts';
import { mergeHonorUnlockTags } from '../../shared/honorUnlocks';
import { createDefaultSaveData, normalizeSaveData } from '../../shared/save-data';

export const SAVE_READ_FAILURE_NOTICE =
    'Save read failed. Started a temporary in-memory profile and paused autosave to avoid overwriting recoverable data.';

export interface HydratedAppStatePatch {
    hydrated: true;
    hydrating: false;
    saveData: SaveData;
    saveReadFailureNotice: string | null;
    saveWritesBlockedByReadFailure: boolean;
    settings: Settings;
    steamConnected: boolean;
    view: 'menu';
}

export interface CreateHydratedAppStatePatchInput {
    desktop: Pick<DesktopApi, 'getSaveData' | 'isSteamConnected'>;
    persistSaveData: (saveData: SaveData) => Promise<SaveData> | SaveData;
}

export const createHydratedAppStatePatch = async ({
    desktop,
    persistSaveData
}: CreateHydratedAppStatePatchInput): Promise<HydratedAppStatePatch> => {
    let saveReadFailed = false;
    const [rawSave, steamConnected] = await Promise.all([
        desktop
            .getSaveData()
            .then(normalizeSaveData)
            .catch(() => {
                saveReadFailed = true;
                return createDefaultSaveData();
            }),
        desktop.isSteamConnected().catch(() => false)
    ]);

    const saveData = mergeHonorUnlockTags(rawSave);
    if (saveData !== rawSave && !saveReadFailed) {
        void persistSaveData(saveData);
    }

    return {
        hydrating: false,
        hydrated: true,
        steamConnected,
        saveData,
        settings: saveData.settings,
        view: 'menu',
        saveReadFailureNotice: saveReadFailed ? SAVE_READ_FAILURE_NOTICE : null,
        saveWritesBlockedByReadFailure: saveReadFailed
    };
};
