import { app, ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import type { DisplayMode, RendererErrorKind, RichPresenceState, SaveData, Settings } from '../shared/contracts';
import {
    normalizeRendererErrorReport,
    normalizeUnknownAchievementId,
    normalizeUnknownDisplayMode
} from '../shared/desktop-api-boundary';
import { IPC_CHANNELS, IPC_CHANNELS_LEGACY_DESKTOP } from '../shared/ipc-channels';
import type { PersistenceService } from './persistence';
import type { SteamAdapter } from './steam';

const applyDisplayMode = (window: BrowserWindow, mode: DisplayMode): void => {
    window.setFullScreen(mode === 'fullscreen');
};

export interface RendererErrorSink {
    record: (kind: RendererErrorKind, error: unknown, detail?: string | null) => void;
}

/** Anything else the renderer claims is recorded as a render error rather than trusted. */
const RENDERER_ERROR_KINDS: readonly RendererErrorKind[] = [
    'renderer_error',
    'renderer_window_error',
    'renderer_unhandled_rejection'
];

const normalizeRendererErrorKind = (value: unknown): RendererErrorKind =>
    RENDERER_ERROR_KINDS.find((kind) => kind === value) ?? 'renderer_error';

export const registerIpcHandlers = (
    getMainWindow: () => BrowserWindow | null,
    persistence: PersistenceService,
    steamAdapter: SteamAdapter,
    /** Where a caught render error is written down. Optional so existing callers keep working. */
    rendererErrorSink: RendererErrorSink | null = null
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
        let saveData: SaveData;
        try {
            saveData = persistence.saveSettings(settings);
        } catch (error) {
            console.error('[ipc] save-settings failed', error);
            throw error;
        }
        const window = getMainWindow();
        if (window && !window.isDestroyed()) {
            try {
                applyDisplayMode(window, saveData.settings.displayMode);
            } catch (error) {
                console.error('[ipc] saved display mode could not be applied', saveData.settings.displayMode, error);
            }
        }
        return saveData.settings;
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

    const recoverUnreadableSave = () => {
        try {
            return persistence.recoverUnreadableSave();
        } catch (error) {
            console.error('[ipc] recover-unreadable-save failed', error);
            throw error;
        }
    };
    register(IPC_CHANNELS.saveRecoverUnreadable, recoverUnreadableSave);
    register(IPC_CHANNELS_LEGACY_DESKTOP.recoverUnreadableSave, recoverUnreadableSave);

    const reportRendererError = (_event: IpcMainInvokeEvent, rawReport: unknown, rawKind?: unknown): void => {
        try {
            const report = normalizeRendererErrorReport(rawReport);
            // Rebuilt as an Error so the crash log formats and redacts it like every other crash.
            const error = new Error(report.message);
            error.stack = report.stack ?? error.stack;
            rendererErrorSink?.record(normalizeRendererErrorKind(rawKind), error, report.componentStack);
        } catch (error) {
            // A failure to write the report must not take out the screen apologising for one.
            console.error('[ipc] report-renderer-error failed', error);
        }
    };
    register(IPC_CHANNELS.diagnosticsReportRendererError, reportRendererError);
    register(IPC_CHANNELS_LEGACY_DESKTOP.reportRendererError, reportRendererError);

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

    /** Cosmetic: a presence failure must never surface to the renderer as a rejected invoke. */
    const setRichPresence = (_event: IpcMainInvokeEvent, state: RichPresenceState): void => {
        try {
            steamAdapter.setRichPresence(state);
        } catch (error) {
            console.warn('[ipc] rich presence update failed', error);
        }
    };
    register(IPC_CHANNELS.steamSetRichPresence, setRichPresence);
    register(IPC_CHANNELS_LEGACY_DESKTOP.setRichPresence, setRichPresence);

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
