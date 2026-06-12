import { describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import {
    SAVE_READ_FAILURE_NOTICE,
    createHydratedAppStatePatch
} from './hydrationController';

describe('hydrationController', () => {
    it('returns a hydrated menu patch from saved data and Steam status', async () => {
        const saveData: SaveData = {
            ...createDefaultSaveData(),
            bestScore: 1234
        };
        const persistSaveData = vi.fn();

        const patch = await createHydratedAppStatePatch({
            desktop: {
                getSaveData: async () => saveData,
                isSteamConnected: async () => true
            },
            persistSaveData
        });

        expect(patch).toMatchObject({
            hydrated: true,
            hydrating: false,
            saveReadFailureNotice: null,
            saveWritesBlockedByReadFailure: false,
            steamConnected: true,
            view: 'menu'
        });
        expect(patch.saveData.bestScore).toBe(1234);
        expect(patch.settings).toBe(patch.saveData.settings);
    });

    it('falls back to defaults and blocks writes when save read fails', async () => {
        const persistSaveData = vi.fn();

        const patch = await createHydratedAppStatePatch({
            desktop: {
                getSaveData: async () => {
                    throw new Error('corrupt save');
                },
                isSteamConnected: async () => {
                    throw new Error('bridge unavailable');
                }
            },
            persistSaveData
        });

        expect(patch.saveReadFailureNotice).toBe(SAVE_READ_FAILURE_NOTICE);
        expect(patch.saveWritesBlockedByReadFailure).toBe(true);
        expect(patch.steamConnected).toBe(false);
        expect(patch.saveData).toEqual(createDefaultSaveData());
        expect(persistSaveData).not.toHaveBeenCalled();
    });
});
