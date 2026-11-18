import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopApi } from '../shared/contracts';
import { createDefaultSaveData, normalizeUnknownSaveDataOrThrow } from '../shared/save-data';

/** The test storage stub lists its keys through length and key(), as a browser's Storage does. */
const storedKeys = (): string[] =>
    Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter((key): key is string => key !== null);

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
    it('keeps an unreadable save beside the fresh profile, as the recovery notice promises', async () => {
        const { desktopClient, UNREADABLE_SAVE_KEY_PREFIX } = await import('./desktop-client');
        window.localStorage.setItem('memory-dungeon-save-data', '{not json');
        await expect(desktopClient.getSaveData()).rejects.toThrow();

        const fresh = await desktopClient.recoverUnreadableSave();

        expect(fresh).toEqual(normalizeUnknownSaveDataOrThrow(createDefaultSaveData()));
        const kept = storedKeys().filter((key) => key.startsWith(UNREADABLE_SAVE_KEY_PREFIX));
        expect(kept).toHaveLength(1);
        expect(window.localStorage.getItem(kept[0]!)).toBe('{not json');
    });

    it('keeps only the newest unreadable saves', async () => {
        const { desktopClient, UNREADABLE_SAVE_KEY_PREFIX, UNREADABLE_SAVES_KEPT } = await import('./desktop-client');
        for (const at of ['2026-01-01', '2026-02-01', '2026-03-01']) {
            window.localStorage.setItem(`${UNREADABLE_SAVE_KEY_PREFIX}${at}T00:00:00.000Z`, 'old');
        }
        window.localStorage.setItem('memory-dungeon-save-data', '{broken');

        await desktopClient.recoverUnreadableSave();

        const kept = storedKeys().filter((key) => key.startsWith(UNREADABLE_SAVE_KEY_PREFIX)).sort();
        expect(kept).toHaveLength(UNREADABLE_SAVES_KEPT);
        expect(kept.some((key) => key.includes('2026-01-01'))).toBe(false);
        expect(window.localStorage.getItem(kept[kept.length - 1]!)).toBe('{broken');
    });

    it('overwrites nothing when the unreadable save cannot be kept', async () => {
        const { desktopClient } = await import('./desktop-client');
        window.localStorage.setItem('memory-dungeon-save-data', '{broken');
        const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
            throw new Error('quota');
        });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(desktopClient.recoverUnreadableSave()).rejects.toThrow('quota');
        setItem.mockRestore();
        expect(window.localStorage.getItem('memory-dungeon-save-data')).toBe('{broken');
    });
});
