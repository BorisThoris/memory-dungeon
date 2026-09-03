import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../shared/contracts';
import { DESKTOP_IPC_CHANNELS } from '../shared/ipc-channels';

const desktopApi: DesktopApi = {
    getSettings: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getSettings),
    saveSettings: (settings) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.saveSettings, settings),
    getSaveData: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.getSaveData),
    saveGame: (data) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.saveGame, data),
    unlockAchievement: (achievementId) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.unlockAchievement, achievementId),
    setRichPresence: (state) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.setRichPresence, state),
    isSteamConnected: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.isSteamConnected),
    setDisplayMode: (mode) => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.setDisplayMode, mode),
    quitApp: () => ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.quitApp)
};

contextBridge.exposeInMainWorld('desktop', desktopApi);
