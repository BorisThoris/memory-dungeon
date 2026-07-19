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
});
