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
            { isConnected: () => false, setRichPresence: () => {}, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter
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
            { isConnected: () => true, setRichPresence: () => {}, unlockAchievement } satisfies SteamAdapter
        );
        const handler = electronMocks.handlers.get(IPC_CHANNELS.steamUnlockAchievement);

        expect(handler?.({}, 'ACH_FIRST_CLEAR')).toEqual({ ok: true });
        expect(persistence.unlockAchievement).toHaveBeenCalledWith('ACH_FIRST_CLEAR');
        expect(unlockAchievement).toHaveBeenCalledWith('ACH_FIRST_CLEAR');
    });

    it('writes a caught render error to the crash log', () => {
        const record = vi.fn();
        registerIpcHandlers(
            () => null,
            {} as PersistenceService,
            { isConnected: () => false, setRichPresence: () => {}, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter,
            { record }
        );
        const handler = electronMocks.handlers.get(IPC_CHANNELS.diagnosticsReportRendererError);

        handler?.({}, { componentStack: '\n    at ShopScreen', message: 'boom', stack: 'Error: boom' });

        // The process survives a render error, so renderer_gone never fires; this is the only
        // record such a failure leaves.
        expect(record).toHaveBeenCalledWith('renderer_error', expect.any(Error), '\n    at ShopScreen');
        expect((record.mock.calls[0]?.[1] as Error).message).toBe('boom');
    });

    it('records the failure kind the renderer names, and distrusts anything else', () => {
        const record = vi.fn();
        registerIpcHandlers(
            () => null,
            {} as PersistenceService,
            { isConnected: () => false, setRichPresence: () => {}, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter,
            { record }
        );
        const handler = electronMocks.handlers.get(IPC_CHANNELS.diagnosticsReportRendererError);

        handler?.({}, { message: 'rejected' }, 'renderer_unhandled_rejection');
        handler?.({}, { message: 'window' }, 'renderer_window_error');
        handler?.({}, { message: 'nonsense kind' }, 'renderer_pretend_kind');

        expect(record.mock.calls.map(([kind]) => kind)).toEqual([
            'renderer_unhandled_rejection',
            'renderer_window_error',
            'renderer_error'
        ]);
    });

    it('does not let a malformed report take out the handler', () => {
        const record = vi.fn();
        registerIpcHandlers(
            () => null,
            {} as PersistenceService,
            { isConnected: () => false, setRichPresence: () => {}, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter,
            { record }
        );
        const handler = electronMocks.handlers.get(IPC_CHANNELS.diagnosticsReportRendererError);

        // Whatever state produced the crash also produced this payload.
        expect(() => handler?.({}, 'not a report')).not.toThrow();
        expect(record).toHaveBeenCalledTimes(1);
    });

    it('registers every canonical and legacy desktop channel exactly once', () => {
        registerIpcHandlers(
            () => null,
            {} as PersistenceService,
            { isConnected: () => false, setRichPresence: () => {}, unlockAchievement: () => ({ ok: false, reason: 'not_connected' }) } satisfies SteamAdapter
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
