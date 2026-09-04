import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/contracts';
import { DESKTOP_IPC_CHANNELS } from '../shared/ipc-channels';

const desktopApi: DesktopApi = {
    saveSettings: (settings) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.saveSettings, settings),
    getSaveData: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getSaveData),
    saveGame: (data) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.saveGame, data),
    recoverUnreadableSave: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.recoverUnreadableSave),
    reportRendererError: (report, kind) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.reportRendererError, report, kind),
    getCrashReportSummary: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getCrashReportSummary),
    revealSaveFile: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.revealSaveFile),
    unlockAchievement: (achievementId) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.unlockAchievement, achievementId),
    setRichPresence: (state) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.setRichPresence, state),
    isSteamConnected: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.isSteamConnected),
    quitApp: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.quitApp)
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
