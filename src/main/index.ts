import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow } from 'electron';
import type { DisplayMode } from '../shared/contracts';
import { resolveDevServerUrl } from './dev-server-url';
import { registerIpcHandlers } from './ipc';
import { PersistenceService } from './persistence';
import {
    RENDERER_SECURITY_WEB_PREFERENCES,
    rendererNavigationIsAllowed
} from './renderer-security-policy';
import { createSteamAdapter } from './steam';
import { resolveStartupDisplayMode } from './startup-display-mode';

/** Single BrowserWindow; getter supports IPC after macOS close + activate without re-registering handlers. */
let mainWindow: BrowserWindow | null = null;
let persistence: PersistenceService | null = null;
let steamAdapter: ReturnType<typeof createSteamAdapter> | null = null;
let ipcHandlersRegistered = false;

const createMainWindow = (displayMode: DisplayMode): BrowserWindow => {
    const window = new BrowserWindow({
        width: 1600,
        height: 960,
        minWidth: 1280,
        minHeight: 720,
        show: false,
        fullscreen: displayMode === 'fullscreen',
        backgroundColor: '#090d18',
        autoHideMenuBar: true,
        title: 'Memory Dungeon',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            ...RENDERER_SECURITY_WEB_PREFERENCES
        }
    });

    window.once('ready-to-show', () => {
        window.show();
    });

    const devServerUrl = resolveDevServerUrl(process.env.VITE_DEV_SERVER_URL, app.isPackaged);
    const rendererFilePath = path.join(app.getAppPath(), 'dist', 'index.html');
    const rendererEntryUrl = devServerUrl ?? pathToFileURL(rendererFilePath).href;

    window.webContents.on('will-navigate', (event, targetUrl) => {
        if (!rendererNavigationIsAllowed(targetUrl, rendererEntryUrl)) {
            event.preventDefault();
        }
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    if (devServerUrl) {
        void window.loadURL(devServerUrl);
        window.webContents.openDevTools({ mode: 'detach' });
    } else {
        void window.loadFile(rendererFilePath);
    }

    window.on('closed', () => {
        if (mainWindow === window) {
            mainWindow = null;
        }
    });

    return window;
};

const ensureServicesAndIpc = (): void => {
    if (!persistence) {
        persistence = new PersistenceService();
    }
    if (!steamAdapter) {
        steamAdapter = createSteamAdapter();
    }
    if (!ipcHandlersRegistered && persistence && steamAdapter) {
        registerIpcHandlers(() => mainWindow, persistence, steamAdapter);
        ipcHandlersRegistered = true;
    }
};

const createOrShowMainWindow = (): void => {
    ensureServicesAndIpc();

    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
        return;
    }

    const displayMode = persistence ? resolveStartupDisplayMode(persistence) : 'windowed';
    mainWindow = createMainWindow(displayMode);
};

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        createOrShowMainWindow();
    });

    app.whenReady().then(() => {
        createOrShowMainWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createOrShowMainWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
