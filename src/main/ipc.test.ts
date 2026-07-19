import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { createDefaultSaveData } from '../shared/save-data';
import { IPC_CHANNELS } from '../shared/ipc-channels';

const electronMocks = vi.hoisted(() => ({
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    quit: vi.fn()
}));

vi.mock('electron', () => ({
    app: { quit: electronMocks.quit },
    ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
            electronMocks.handlers.set(channel, handler);
        })
    }
}));

import { registerIpcHandlers } from './ipc';
import type { PersistenceService } from './persistence';
import type { SteamAdapter } from './steam';

describe('registerIpcHandlers', () => {
    beforeEach(() => {
        electronMocks.handlers.clear();
        electronMocks.quit.mockClear();
    });

    it('does not report a successful settings commit as failed when fullscreen application throws', () => {
        const saveData = createDefaultSaveData();
        saveData.settings.displayMode = 'fullscreen';
        const persistence = {
            saveSettings: vi.fn(() => saveData)
        } as unknown as PersistenceService;
        const window = {
            isDestroyed: () => false,
            setFullScreen: vi.fn(() => {
                throw new Error('window manager rejected fullscreen');
            })
        };
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        registerIpcHandlers(
            () => window as unknown as BrowserWindow,
            persistence,
            { isConnected: () => false, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter
        );
        const handler = electronMocks.handlers.get(IPC_CHANNELS.saveSaveSettings);

        expect(handler?.({}, saveData.settings)).toEqual(saveData.settings);
        expect(persistence.saveSettings).toHaveBeenCalledWith(saveData.settings);
        expect(window.setFullScreen).toHaveBeenCalledWith(true);
        expect(reportError).toHaveBeenCalledWith(
            '[ipc] saved display mode could not be applied',
            'fullscreen',
            expect.any(Error)
        );
        reportError.mockRestore();
    });
});
