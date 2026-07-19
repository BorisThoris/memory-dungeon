import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { persistSaveDataThenUnlockAchievements } from './achievementPersistence';

vi.mock('../desktop-client', () => ({
    desktopClient: {
        saveGame: vi.fn(),
        unlockAchievement: vi.fn()
    }
}));

import { desktopClient } from '../desktop-client';

describe('persistSaveDataThenUnlockAchievements (REF-036)', () => {
    beforeEach(() => {
        vi.mocked(desktopClient.saveGame).mockImplementation(async (data) => data);
        vi.mocked(desktopClient.unlockAchievement).mockResolvedValue({ ok: true });
    });

    it('persists once before sequential unlock IPCs (no parallel RMW batch race)', async () => {
        const save = createDefaultSaveData();
        const calls: string[] = [];

        vi.mocked(desktopClient.saveGame).mockImplementation(async (data) => {
            calls.push('save');
            return data;
        });
        vi.mocked(desktopClient.unlockAchievement).mockImplementation(async (id) => {
            calls.push(`unlock:${id}`);
            return { ok: true };
        });

        const { failures } = await persistSaveDataThenUnlockAchievements(save, ['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE']);

        expect(calls).toEqual(['save', 'unlock:ACH_FIRST_CLEAR', 'unlock:ACH_LEVEL_FIVE']);
        expect(failures).toEqual([]);
    });

    it('normalizes malformed unlock IPC responses into structured failures', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.mocked(desktopClient.unlockAchievement).mockResolvedValueOnce({ nope: true });

        const { failures } = await persistSaveDataThenUnlockAchievements(createDefaultSaveData(), ['ACH_FIRST_CLEAR']);

        expect(failures).toEqual([
            {
                id: 'ACH_FIRST_CLEAR',
                result: {
                    ok: false,
                    reason: 'steam_rejected',
                    detail: 'Malformed Steam bridge response.'
                }
            }
        ]);
        expect(warn).toHaveBeenCalledWith(
            '[achievements] Steam bridge did not report success',
            'ACH_FIRST_CLEAR',
            failures[0]?.result
        );
        warn.mockRestore();
    });

    it('records a rejected unlock invoke and continues syncing later achievements', async () => {
        const calls: string[] = [];
        const bridgeError = new Error('IPC unavailable');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        vi.mocked(desktopClient.unlockAchievement).mockImplementation(async (id) => {
            calls.push(id);
            if (id === 'ACH_FIRST_CLEAR') {
                throw bridgeError;
            }
            return { ok: true };
        });

        const { failures } = await persistSaveDataThenUnlockAchievements(createDefaultSaveData(), [
            'ACH_FIRST_CLEAR',
            'ACH_LEVEL_FIVE'
        ]);

        expect(calls).toEqual(['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE']);
        expect(failures).toEqual([
            {
                id: 'ACH_FIRST_CLEAR',
                result: { ok: false, reason: 'steam_rejected', detail: 'bridge_error' }
            }
        ]);
        expect(warn).toHaveBeenCalledWith('[achievements] Steam bridge invoke failed', 'ACH_FIRST_CLEAR');
        warn.mockRestore();
    });
});
