import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { createDefaultSaveData } from '../shared/save-data';
import {
    DESKTOP_IPC_CHANNELS,
    IPC_CHANNELS,
    IPC_CHANNELS_LEGACY_DESKTOP
} from '../shared/ipc-channels';

const electronMocks = vi.hoisted(() => ({
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        electronMocks.handlers.set(channel, handler);
    }),
    handlers: new Map<string, (...args: unknown[]) => unknown>(),
    quit: vi.fn()
}));

vi.mock('electron', () => ({
    app: { quit: electronMocks.quit },
    ipcMain: {
        handle: electronMocks.handle
    }
}));

import { registerIpcHandlers } from './ipc';
import type { PersistenceService } from './persistence';
import type { SteamAdapter } from './steam';

describe('registerIpcHandlers', () => {
    beforeEach(() => {
        electronMocks.handlers.clear();
        electronMocks.handle.mockClear();
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

    it('attempts Steam activation even when the achievement is already persisted locally', () => {
        const persistence = {
            unlockAchievement: vi.fn(() => createDefaultSaveData())
        } as unknown as PersistenceService;
        const unlockAchievement = vi.fn(() => ({ ok: true }) as const);

        registerIpcHandlers(
            () => null,
            persistence,
            { isConnected: () => true, unlockAchievement } satisfies SteamAdapter
        );
        const handler = electronMocks.handlers.get(IPC_CHANNELS.steamUnlockAchievement);

        expect(handler?.({}, 'ACH_FIRST_CLEAR')).toEqual({ ok: true });
        expect(persistence.unlockAchievement).toHaveBeenCalledWith('ACH_FIRST_CLEAR');
        expect(unlockAchievement).toHaveBeenCalledWith('ACH_FIRST_CLEAR');
    });

    it('registers every canonical and legacy desktop channel exactly once', () => {
        registerIpcHandlers(
            () => null,
            {} as PersistenceService,
            { isConnected: () => false, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter
        );
        const expectedChannels = [
            ...Object.values(DESKTOP_IPC_CHANNELS),
            ...Object.values(IPC_CHANNELS_LEGACY_DESKTOP)
        ];

        expect(new Set(expectedChannels).size).toBe(expectedChannels.length);
        expect([...electronMocks.handlers.keys()].sort()).toEqual([...expectedChannels].sort());
        expect(electronMocks.handle).toHaveBeenCalledTimes(expectedChannels.length);
        expect([...electronMocks.handlers.values()].every((handler) => typeof handler === 'function')).toBe(true);
    });
});
