import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, screen, shell, dialog } from 'electron';
import type { DisplayMode } from '../shared/contracts';
import { resolveDevServerUrl } from './dev-server-url';
import { handleFatalStartupFailure, runMainProcessAction } from './fatal-startup';
import { registerIpcHandlers } from './ipc';
import { PersistenceService } from './persistence';
import { loadRendererEntry } from './renderer-loader';
import {
    RENDERER_SECURITY_WEB_PREFERENCES,
    rendererNavigationIsAllowed
} from './renderer-security-policy';
import { resolveBuildFlavour } from '../shared/content-lock-state';
import { createSteamAdapter } from './steam';
import { resolveStartupDisplayMode } from './startup-display-mode';
import {
    captureWindowState,
    DEFAULT_WINDOW_HEIGHT,
    DEFAULT_WINDOW_WIDTH,
    MIN_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH,
    resolveRestoredBounds
} from './window-bounds';

/** Single BrowserWindow; getter supports IPC after macOS close + activate without re-registering handlers. */
let mainWindow: BrowserWindow | null = null;
let persistence: PersistenceService | null = null;
let steamAdapter: ReturnType<typeof createSteamAdapter> | null = null;
let ipcHandlersRegistered = false;

/**
 * Where to open. `resolveRestoredBounds` decides whether the stored placement still lands on a
 * display that exists, so a monitor unplugged since last launch opens centred at the default size
 * rather than off-screen.
 */
const resolveStartupBounds = (): { bounds: ReturnType<typeof resolveRestoredBounds>; maximized: boolean } => {
    if (!persistence) {
        return { bounds: null, maximized: false };
    }
    try {
        const stored = persistence.getWindowState();
        const displays = screen.getAllDisplays().map((display) => display.workArea);
        return { bounds: resolveRestoredBounds(stored.bounds, displays), maximized: stored.maximized };
    } catch (error) {
        console.error('[startup] window state read failed', error);
        return { bounds: null, maximized: false };
    }
};

const createMainWindow = (displayMode: DisplayMode): BrowserWindow => {
    const startup = resolveStartupBounds();
    const window = new BrowserWindow({
        width: startup.bounds?.width ?? DEFAULT_WINDOW_WIDTH,
        height: startup.bounds?.height ?? DEFAULT_WINDOW_HEIGHT,
        ...(startup.bounds ? { x: startup.bounds.x, y: startup.bounds.y } : {}),
        // The floor is a comfort limit, not a layout one: every screen is held to fitting far
        // smaller than this by the fit contract, so the window stays resizable on a 1366x768
        // laptop and inside the Steam Deck's 1280x800.
        minWidth: MIN_WINDOW_WIDTH,
        minHeight: MIN_WINDOW_HEIGHT,
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
        if (startup.maximized && displayMode !== 'fullscreen') {
            window.maximize();
        }
        window.show();
    });

    /*
     * Remember the placement as it changes, not only on close: a crash or a forced quit should
     * still leave the window where the player put it. The writes are debounced because a drag
     * fires these continuously.
     */
    let rememberTimer: NodeJS.Timeout | null = null;
    const rememberPlacement = (): void => {
        if (rememberTimer) {
            clearTimeout(rememberTimer);
        }
        rememberTimer = setTimeout(() => {
            rememberTimer = null;
            if (!window.isDestroyed()) {
                persistence?.saveWindowState(captureWindowState(window));
            }
        }, 400);
    };
    window.on('resize', rememberPlacement);
    window.on('move', rememberPlacement);
    window.on('maximize', rememberPlacement);
    window.on('unmaximize', rememberPlacement);
    window.on('close', () => {
        if (rememberTimer) {
            clearTimeout(rememberTimer);
            rememberTimer = null;
        }
        persistence?.saveWindowState(captureWindowState(window));
    });

    const devServerUrl = resolveDevServerUrl(process.env.VITE_DEV_SERVER_URL, app.isPackaged);
    const rendererFilePath = path.join(app.getAppPath(), 'dist', 'index.html');
    const rendererFileUrl = pathToFileURL(rendererFilePath).href;
    let rendererEntryUrl = devServerUrl ?? rendererFileUrl;

    window.webContents.on('will-navigate', (event, targetUrl) => {
        if (!rendererNavigationIsAllowed(targetUrl, rendererEntryUrl)) {
            event.preventDefault();
        }
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
        // The run-end wishlist link is the one outbound link; everything else stays denied.
        if (url.startsWith('https://store.steampowered.com/')) {
            void shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    if (devServerUrl) {
        window.webContents.openDevTools({ mode: 'detach' });
    }
    void loadRendererEntry({
        developmentUrl: devServerUrl,
        loadDevelopmentUrl: (url) => window.loadURL(url),
        loadBundledFile: () => {
            rendererEntryUrl = rendererFileUrl;
            return window.loadFile(rendererFilePath);
        },
        reportError: (source, error) => console.error(`[startup] ${source} renderer load failed`, error)
    }).then((source) => {
        if (source === 'failed' && !window.isDestroyed()) {
            dialog.showErrorBox(
                'Memory Dungeon could not start',
                'The renderer failed to load. Reinstall or rebuild the app, then try again.'
            );
            window.show();
        }
    });

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
        steamAdapter = createSteamAdapter({
            achievementsEnabled: resolveBuildFlavour(process.env.MEMORY_DUNGEON_BUILD_FLAVOUR) !== 'demo'
        });
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
const handleFatalStartup = (error: unknown): void => {
    handleFatalStartupFailure(error, {
        reportError: (failure) => console.error('[startup] fatal main-process failure', failure),
        showError: (title, message) => dialog.showErrorBox(title, message),
        quit: () => app.quit()
    });
};

if (!gotLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        runMainProcessAction(createOrShowMainWindow, handleFatalStartup);
    });

    void app.whenReady().then(() => {
        const started = runMainProcessAction(createOrShowMainWindow, handleFatalStartup);
        if (!started) {
            return;
        }

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                runMainProcessAction(createOrShowMainWindow, handleFatalStartup);
            }
        });
    }).catch(handleFatalStartup);
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
