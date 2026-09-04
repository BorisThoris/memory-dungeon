import type { DesktopApi } from './contracts';

/**
 * Canonical Electron `ipcMain.handle` / `ipcRenderer.invoke` channel names.
 * Namespaced by domain to avoid collisions; legacy `desktop:*` strings stay registered as aliases.
 */
export const IPC_CHANNELS = {
    saveGetSettings: 'save:get-settings',
    saveSaveSettings: 'save:save-settings',
    saveGetSaveData: 'save:get-save-data',
    saveSaveGame: 'save:save-game',
    saveRecoverUnreadable: 'save:recover-unreadable',
    diagnosticsReportRendererError: 'diagnostics:report-renderer-error',
    steamIsConnected: 'steam:is-connected',
    steamUnlockAchievement: 'steam:unlock-achievement',
    steamSetRichPresence: 'steam:set-rich-presence',
    windowSetDisplayMode: 'window:set-display-mode',
    windowQuitApp: 'window:quit-app'
} as const;

/** Maps each {@link DesktopApi} method to its canonical invoke channel (same as main `ipcMain.handle`). */
export const DESKTOP_IPC_CHANNELS: { [K in keyof DesktopApi]: string } = {
    getSettings: IPC_CHANNELS.saveGetSettings,
    saveSettings: IPC_CHANNELS.saveSaveSettings,
    getSaveData: IPC_CHANNELS.saveGetSaveData,
    saveGame: IPC_CHANNELS.saveSaveGame,
    recoverUnreadableSave: IPC_CHANNELS.saveRecoverUnreadable,
    reportRendererError: IPC_CHANNELS.diagnosticsReportRendererError,
    unlockAchievement: IPC_CHANNELS.steamUnlockAchievement,
    setRichPresence: IPC_CHANNELS.steamSetRichPresence,
    isSteamConnected: IPC_CHANNELS.steamIsConnected,
    setDisplayMode: IPC_CHANNELS.windowSetDisplayMode,
    quitApp: IPC_CHANNELS.windowQuitApp
};

/** @deprecated Prefer {@link IPC_CHANNELS}; kept for main-process alias registration. */
export const IPC_CHANNELS_LEGACY_DESKTOP: { [K in keyof DesktopApi]: string } = {
    getSettings: 'desktop:get-settings',
    saveSettings: 'desktop:save-settings',
    getSaveData: 'desktop:get-save-data',
    saveGame: 'desktop:save-game',
    recoverUnreadableSave: 'desktop:recover-unreadable-save',
    reportRendererError: 'desktop:report-renderer-error',
    isSteamConnected: 'desktop:is-steam-connected',
    unlockAchievement: 'desktop:unlock-achievement',
    setRichPresence: 'desktop:set-rich-presence',
    setDisplayMode: 'desktop:set-display-mode',
    quitApp: 'desktop:quit-app'
};
