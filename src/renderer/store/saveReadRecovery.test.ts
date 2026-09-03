import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { createHydratedAppStatePatch, SAVE_READ_FAILURE_NOTICE } from './hydrationController';

const desktopMocks = vi.hoisted(() => ({
    recoverUnreadableSave: vi.fn()
}));

vi.mock('../desktop-client', () => ({
    desktopClient: {
        getSaveData: vi.fn(async () => createDefaultSaveData()),
        isSteamConnected: vi.fn(async () => false),
        recoverUnreadableSave: desktopMocks.recoverUnreadableSave,
        saveGame: vi.fn(async (data: unknown) => data),
        saveSettings: vi.fn(async (settings: unknown) => settings)
    }
}));

import { useAppStore } from './useAppStore';

describe('recovering from a save the game cannot read', () => {
    beforeEach(() => {
        desktopMocks.recoverUnreadableSave.mockReset();
        useAppStore.setState({
            saveReadFailureNotice: SAVE_READ_FAILURE_NOTICE,
            saveWritesBlockedByReadFailure: true
        });
    });

    it('blocks writes and says so when the save cannot be read', async () => {
        const patch = await createHydratedAppStatePatch({
            desktop: {
                getSaveData: async () => {
                    throw new TypeError('Save data uses a newer unsupported schema version.');
                },
                isSteamConnected: async () => false
            },
            persistSaveData: async (saveData) => saveData
        });

        expect(patch.saveWritesBlockedByReadFailure).toBe(true);
        expect(patch.saveReadFailureNotice).toBe(SAVE_READ_FAILURE_NOTICE);
        // A newer save is the ordinary case, not a broken one: a player on the beta branch syncs
        // their file down to an older build through Steam Cloud. They still get a playable game.
        expect(patch.hydrated).toBe(true);
        expect(patch.view).toBe('menu');
    });

    it('unblocks writes once the player starts a fresh profile', async () => {
        const fresh = createDefaultSaveData();
        desktopMocks.recoverUnreadableSave.mockResolvedValue(fresh);

        await useAppStore.getState().recoverUnreadableSave();

        expect(desktopMocks.recoverUnreadableSave).toHaveBeenCalledTimes(1);
        expect(useAppStore.getState().saveWritesBlockedByReadFailure).toBe(false);
        expect(useAppStore.getState().saveReadFailureNotice).toBeNull();
    });

    it('keeps writes blocked when the recovery itself fails', async () => {
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        desktopMocks.recoverUnreadableSave.mockRejectedValue(new Error('disk full'));

        await useAppStore.getState().recoverUnreadableSave();

        // Staying blocked is the safe half: the old file is untouched and the notice is still up.
        expect(useAppStore.getState().saveWritesBlockedByReadFailure).toBe(true);
        expect(useAppStore.getState().saveReadFailureNotice).toMatch(/has not been changed/);
        reportError.mockRestore();
    });

    it('does nothing when writes were never blocked', async () => {
        useAppStore.setState({ saveReadFailureNotice: null, saveWritesBlockedByReadFailure: false });

        await useAppStore.getState().recoverUnreadableSave();

        expect(desktopMocks.recoverUnreadableSave).not.toHaveBeenCalled();
    });
});
