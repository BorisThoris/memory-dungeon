import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopApi } from '../shared/contracts';
import { createDefaultSaveData, normalizeUnknownSaveDataOrThrow } from '../shared/save-data';

describe('browser desktop client persistence', () => {
    beforeEach(() => {
        vi.resetModules();
        window.localStorage.clear();
        delete (window as Window & { desktop?: DesktopApi }).desktop;
    });

    it('does not let a stale game snapshot overwrite separately persisted settings', async () => {
        const { desktopClient } = await import('./desktop-client');
        const staleSave = createDefaultSaveData();
        await desktopClient.saveSettings({
            ...staleSave.settings,
            displayMode: 'fullscreen',
            reduceMotion: true
        });

        const committed = normalizeUnknownSaveDataOrThrow(
            await desktopClient.saveGame({ ...staleSave, bestScore: 9001 })
        );

        expect(committed.bestScore).toBe(9001);
        expect(committed.settings).toMatchObject({ displayMode: 'fullscreen', reduceMotion: true });
        await expect(desktopClient.getSaveData()).resolves.toEqual(committed);
    });

    it('reports no save on a first launch, so hydration picks the graphics tier for the device', async () => {
        // Low, not the default Medium, so the test can tell a chosen tier from the default one.
        vi.doMock('./graphicsTier', () => ({ detectGraphicsTier: () => 'low' }));
        const { desktopClient } = await import('./desktop-client');
        await expect(desktopClient.getSaveData()).resolves.toBeNull();

        const { createHydratedAppStatePatch } = await import('./store/hydrationController');
        const firstBoot = await createHydratedAppStatePatch({
            desktop: { getSaveData: () => desktopClient.getSaveData(), isSteamConnected: async () => false },
            persistSaveData: async (saveData) => normalizeUnknownSaveDataOrThrow(await desktopClient.saveGame(saveData))
        });
        expect(firstBoot.settings.graphicsQuality).toBe('low');
        // And it is the chosen tier that is stored, so the next launch starts on it too.
        await vi.waitFor(async () => {
            expect(normalizeUnknownSaveDataOrThrow(await desktopClient.getSaveData()).settings.graphicsQuality).toBe('low');
        });
        vi.doUnmock('./graphicsTier');
    });

    it('rejects unavailable storage reads instead of returning a disposable default profile', async () => {
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
            throw new Error('storage access denied');
        });
        const { desktopClient } = await import('./desktop-client');

        await expect(desktopClient.getSaveData()).rejects.toThrow('storage access denied');
        expect(reportError).toHaveBeenCalledWith('[desktop-client] localStorage read unavailable', expect.any(Error));
    });

    it('rejects unavailable storage writes instead of acknowledging an in-memory result', async () => {
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
            throw new Error('storage quota unavailable');
        });
        const { desktopClient } = await import('./desktop-client');

        await expect(desktopClient.saveGame(createDefaultSaveData())).rejects.toThrow('storage quota unavailable');
        expect(reportError).toHaveBeenCalledWith('[desktop-client] localStorage write failed', expect.any(Error));
    });
});
