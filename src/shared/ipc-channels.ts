import type { DesktopApi } from './contracts';

/**
 * Canonical Electron `ipcMain.handle` / `ipcRenderer.invoke` channel names.
 * Namespaced by domain to avoid collisions; legacy `desktop:*` strings stay registered as aliases.
 */
export const IPC_CHANNELS = {
    saveSaveSettings: 'save:save-settings',
    saveGetSaveData: 'save:get-save-data',
    saveSaveGame: 'save:save-game',
    saveRecoverUnreadable: 'save:recover-unreadable',
    diagnosticsReportRendererError: 'diagnostics:report-renderer-error',
    diagnosticsGetCrashSummary: 'diagnostics:get-crash-summary',
    steamIsConnected: 'steam:is-connected',
    steamUnlockAchievement: 'steam:unlock-achievement',
    steamSetRichPresence: 'steam:set-rich-presence',
    windowQuitApp: 'window:quit-app'
} as const;

/** Maps each {@link DesktopApi} method to its canonical invoke channel (same as main `ipcMain.handle`). */
export const DESKTOP_IPC_CHANNELS: { [K in keyof DesktopApi]: string } = {
    saveSettings: IPC_CHANNELS.saveSaveSettings,
    getSaveData: IPC_CHANNELS.saveGetSaveData,
    saveGame: IPC_CHANNELS.saveSaveGame,
    recoverUnreadableSave: IPC_CHANNELS.saveRecoverUnreadable,
    reportRendererError: IPC_CHANNELS.diagnosticsReportRendererError,
    getCrashReportSummary: IPC_CHANNELS.diagnosticsGetCrashSummary,
    unlockAchievement: IPC_CHANNELS.steamUnlockAchievement,
    setRichPresence: IPC_CHANNELS.steamSetRichPresence,
    isSteamConnected: IPC_CHANNELS.steamIsConnected,
    quitApp: IPC_CHANNELS.windowQuitApp
};

/** @deprecated Prefer {@link IPC_CHANNELS}; kept for main-process alias registration. */
export const IPC_CHANNELS_LEGACY_DESKTOP: { [K in keyof DesktopApi]: string } = {
    saveSettings: 'desktop:save-settings',
    getSaveData: 'desktop:get-save-data',
    saveGame: 'desktop:save-game',
    recoverUnreadableSave: 'desktop:recover-unreadable-save',
    reportRendererError: 'desktop:report-renderer-error',
    getCrashReportSummary: 'desktop:get-crash-summary',
    isSteamConnected: 'desktop:is-steam-connected',
    unlockAchievement: 'desktop:unlock-achievement',
    setRichPresence: 'desktop:set-rich-presence',
    quitApp: 'desktop:quit-app'
};
