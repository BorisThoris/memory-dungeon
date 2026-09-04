import type {
    AchievementUnlockResult,
    CrashReportSummary,
    DesktopApi,
    SaveData,
    Settings
} from '../shared/contracts';
import { createDefaultSaveData, normalizeSaveData, normalizeUnknownSaveDataOrThrow } from '../shared/save-data';

const STORAGE_KEY = 'memory-dungeon-save-data';

const getBrowserStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    return window.localStorage ?? null;
};

const readLocalSave = (): SaveData => {
    let rawValue: string | null = null;
    try {
        const storage = getBrowserStorage();
        if (!storage) {
            throw new Error('Browser storage is unavailable.');
        }
        rawValue = storage.getItem(STORAGE_KEY);
    } catch (error) {
        console.error('[desktop-client] localStorage read unavailable', error);
        throw error;
    }

    if (!rawValue) {
        return createDefaultSaveData();
    }

    try {
        return normalizeUnknownSaveDataOrThrow(JSON.parse(rawValue));
    } catch (error) {
        console.error('[desktop-client] localStorage read failed', error);
        throw error;
    }
};

const writeLocalSave = (saveData: SaveData): SaveData => {
    const normalized = normalizeSaveData(saveData);

    try {
        const storage = getBrowserStorage();
        if (!storage) {
            throw new Error('Browser storage is unavailable.');
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
        console.error('[desktop-client] localStorage write failed', error);
        throw error;
    }

    return normalized;
};

const fallbackClient: DesktopApi = {
    async saveSettings(settings: Settings): Promise<Settings> {
        const saveData = readLocalSave();
        return writeLocalSave({ ...saveData, settings }).settings;
    },
    async getSaveData(): Promise<SaveData> {
        return readLocalSave();
    },
    async saveGame(data: SaveData): Promise<SaveData> {
        const currentSave = readLocalSave();
        return writeLocalSave({ ...data, settings: currentSave.settings });
    },
    async recoverUnreadableSave(): Promise<SaveData> {
        // The browser fallback keeps its save in local storage, so there is no file to set aside;
        // the honest equivalent is to write a fresh profile over the one that could not be read.
        return writeLocalSave(createDefaultSaveData());
    },
    async getCrashReportSummary(): Promise<CrashReportSummary> {
        // The browser fallback has no main process and so no crash logs on disk.
        return { count: 0, directory: '', latestFileName: null };
    },
    async reportRendererError(): Promise<void> {
        // No main process in the browser fallback, so there is nowhere to write a crash log. The
        // boundary still shows the player what happened; only the record on disk is missing.
    },
    async setRichPresence(): Promise<void> {
        // No Steam in the browser fallback; presence is cosmetic, so this is a silent no-op.
    },
    async unlockAchievement(): Promise<AchievementUnlockResult> {
        return { ok: false, reason: 'not_connected' };
    },
    async isSteamConnected(): Promise<boolean> {
        return false;
    },
    async quitApp(): Promise<void> {
        /* Electron uses preload IPC; web/Vitest uses this no-op unless window.desktop is mocked. */
    }
};

const pickDesktopBridge = (): DesktopApi => {
    if (typeof window === 'undefined') {
        return fallbackClient;
    }
    return window.desktop ?? fallbackClient;
};

export const desktopClient: DesktopApi = pickDesktopBridge();
