import { app, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { DisplayMode, SaveData, Settings } from '../shared/contracts';
import { normalizeUnknownAchievementId, normalizeUnknownDisplayMode } from '../shared/desktop-api-boundary';
import { IPC_CHANNELS, IPC_CHANNELS_LEGACY_DESKTOP } from '../shared/ipc-channels';
import type { PersistenceService } from './persistence';
import type { SteamAdapter } from './steam';

const applyDisplayMode = (window: BrowserWindow, mode: DisplayMode): void => {
    try {
        window.setFullScreen(mode === 'fullscreen');
    } catch (error) {
        console.error('[ipc] setFullScreen failed', mode, error);
        throw error;
    }
};

export const registerIpcHandlers = (
    getMainWindow: () => BrowserWindow | null,
    persistence: PersistenceService,
    steamAdapter: SteamAdapter
): void => {
    const register = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
        ipcMain.handle(channel, handler);
    };

    const getSettings = (): ReturnType<PersistenceService['getSettings']> => {
        try {
            return persistence.getSettings();
        } catch (error) {
            console.error('[ipc] get-settings failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.saveGetSettings, getSettings);
    register(IPC_CHANNELS_LEGACY_DESKTOP.getSettings, getSettings);

    const getSaveData = (): ReturnType<PersistenceService['getSaveData']> => {
        try {
            return persistence.getSaveData();
        } catch (error) {
            console.error('[ipc] get-save-data failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.saveGetSaveData, getSaveData);
    register(IPC_CHANNELS_LEGACY_DESKTOP.getSaveData, getSaveData);

    const isSteamConnected = (): boolean => {
        try {
            return steamAdapter.isConnected();
        } catch (error) {
            console.error('[ipc] steam is-connected failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.steamIsConnected, isSteamConnected);
    register(IPC_CHANNELS_LEGACY_DESKTOP.isSteamConnected, isSteamConnected);

    const setDisplayMode = (_event: IpcMainInvokeEvent, rawMode: unknown): void => {
        try {
            const mode = normalizeUnknownDisplayMode(rawMode);
            if (!mode) {
                console.warn('[ipc] set-display-mode skipped: invalid display mode', rawMode);
                return;
            }
            const window = getMainWindow();
            if (!window || window.isDestroyed()) {
                console.warn('[ipc] set-display-mode skipped: no main window');
                return;
            }
            applyDisplayMode(window, mode);
        } catch (error) {
            console.error('[ipc] set-display-mode failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.windowSetDisplayMode, setDisplayMode);
    register(IPC_CHANNELS_LEGACY_DESKTOP.setDisplayMode, setDisplayMode);

    const saveSettings = (_event: IpcMainInvokeEvent, settings: unknown): Settings => {
        try {
            const saveData = persistence.saveSettings(settings);
            const window = getMainWindow();
            if (window && !window.isDestroyed()) {
                applyDisplayMode(window, saveData.settings.displayMode);
            }
            return saveData.settings;
        } catch (error) {
            console.error('[ipc] save-settings failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.saveSaveSettings, saveSettings);
    register(IPC_CHANNELS_LEGACY_DESKTOP.saveSettings, saveSettings);

    const saveGame = (_event: IpcMainInvokeEvent, saveData: unknown): SaveData => {
        try {
            return persistence.saveGame(saveData);
        } catch (error) {
            console.error('[ipc] save-game failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.saveSaveGame, saveGame);
    register(IPC_CHANNELS_LEGACY_DESKTOP.saveGame, saveGame);

    const unlockAchievement = (_event: IpcMainInvokeEvent, rawAchievementId: unknown) => {
        try {
            const achievementId = normalizeUnknownAchievementId(rawAchievementId);
            if (!achievementId) {
                return { ok: false, reason: 'persistence_error', detail: 'Invalid achievement id.' } as const;
            }
            persistence.unlockAchievement(achievementId);
            return steamAdapter.unlockAchievement(achievementId);
        } catch (error) {
            console.error('[ipc] unlock-achievement failed', rawAchievementId, error);
            throw error;
        }
    };
    register(IPC_CHANNELS.steamUnlockAchievement, unlockAchievement);
    register(IPC_CHANNELS_LEGACY_DESKTOP.unlockAchievement, unlockAchievement);

    const quitApp = (): void => {
        try {
            app.quit();
        } catch (error) {
            console.error('[ipc] quit-app failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.windowQuitApp, quitApp);
    register(IPC_CHANNELS_LEGACY_DESKTOP.quitApp, quitApp);
};
