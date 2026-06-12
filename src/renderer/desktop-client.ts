import type { AchievementUnlockResult, DesktopApi, DisplayMode, SaveData, Settings } from '../shared/contracts';
import { createDefaultSaveData, normalizeSaveData, normalizeUnknownSaveData } from '../shared/save-data';

const STORAGE_KEY = 'memory-dungeon-save-data';

const getBrowserStorage = (): Storage | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        return window.localStorage ?? null;
    } catch (error) {
        console.warn('[desktop-client] localStorage unavailable; using in-memory defaults', error);
        return null;
    }
};

const readLocalSave = (): SaveData => {
    const storage = getBrowserStorage();
    if (!storage) {
        return createDefaultSaveData();
    }

    let rawValue: string | null = null;
    try {
        rawValue = storage.getItem(STORAGE_KEY);
    } catch (error) {
        console.warn('[desktop-client] localStorage read unavailable; using in-memory defaults', error);
        return createDefaultSaveData();
    }

    if (!rawValue) {
        return createDefaultSaveData();
    }

    try {
        return normalizeUnknownSaveData(JSON.parse(rawValue));
    } catch (error) {
        console.error('[desktop-client] localStorage read failed', error);
        throw error;
    }
};

const writeLocalSave = (saveData: SaveData): SaveData => {
    const normalized = normalizeSaveData(saveData);

    try {
        const storage = getBrowserStorage();
        if (storage) {
            storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
    } catch (error) {
        console.error('[desktop-client] localStorage write failed', error);
        throw error;
    }

    return normalized;
};

const fallbackClient: DesktopApi = {
    async getSettings(): Promise<Settings> {
        return readLocalSave().settings;
    },
    async saveSettings(settings: Settings): Promise<Settings> {
        const saveData = readLocalSave();
        return writeLocalSave({ ...saveData, settings }).settings;
    },
    async getSaveData(): Promise<SaveData> {
        return readLocalSave();
    },
    async saveGame(data: SaveData): Promise<SaveData> {
        return writeLocalSave(data);
    },
    async unlockAchievement(): Promise<AchievementUnlockResult> {
        return { ok: false, reason: 'not_connected' };
    },
    async isSteamConnected(): Promise<boolean> {
        return false;
    },
    async setDisplayMode(mode: DisplayMode): Promise<void> {
        const saveData = readLocalSave();
        writeLocalSave({
            ...saveData,
            settings: {
                ...saveData.settings,
                displayMode: mode
            }
        });
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

