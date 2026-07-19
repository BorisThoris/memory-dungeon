import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';

vi.mock('../desktop-client', () => ({
    desktopClient: {
        saveGame: vi.fn(),
        saveSettings: vi.fn()
    }
}));

import {
    createSaveHealthSnapshot,
    getSaveHealthSnapshot,
    persistSaveData,
    persistSaveSettings,
    persistenceNoticeForConsecutiveFailures,
    registerPersistenceWriteFailureHandler,
    saveHealthCopyForSnapshot
} from './persistBridge';
import { desktopClient } from '../desktop-client';

describe('REG-040 persistence health copy', () => {
    beforeEach(async () => {
        const saveData = createDefaultSaveData();
        vi.mocked(desktopClient.saveGame).mockImplementation(async (data) => data);
        vi.mocked(desktopClient.saveSettings).mockImplementation(async (settings) => settings);
        registerPersistenceWriteFailureHandler(null);
        await persistSaveData(saveData);
    });
    it('routes first and repeated failures to actionable save-health states', () => {
        const first = createSaveHealthSnapshot({ consecutive: 1, op: 'game' });
        expect(first).toEqual({
            status: 'transient_write_failed',
            consecutiveFailures: 1,
            operation: 'game',
            recoveryActions: ['keep_session_open', 'retry_next_save', 'check_disk_space']
        });
        expect(persistenceNoticeForConsecutiveFailures(1)).toBe(saveHealthCopyForSnapshot(first));

        const repeated = createSaveHealthSnapshot({ consecutive: 3, op: 'settings' });
        expect(repeated).toEqual({
            status: 'repeated_write_failed',
            consecutiveFailures: 3,
            operation: 'settings',
            recoveryActions: [
                'keep_session_open',
                'retry_next_save',
                'check_disk_space',
                'check_file_permissions',
                'close_locking_programs'
            ]
        });
        expect(persistenceNoticeForConsecutiveFailures(3)).toContain('setting changes may not persist');
    });

    it('reports a healthy snapshot before write failures occur', () => {
        expect(getSaveHealthSnapshot()).toEqual({
            status: 'ok',
            consecutiveFailures: 0,
            operation: null,
            recoveryActions: []
        });
    });

    it('treats malformed save acknowledgements as uncertain failed writes', async () => {
        const onWriteFail = vi.fn();
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        registerPersistenceWriteFailureHandler(onWriteFail);
        vi.mocked(desktopClient.saveGame).mockResolvedValue(['not', 'a', 'save']);

        await expect(persistSaveData(createDefaultSaveData())).rejects.toThrow('recognized field');
        expect(getSaveHealthSnapshot()).toMatchObject({
            status: 'transient_write_failed',
            consecutiveFailures: 1,
            operation: 'game'
        });
        expect(onWriteFail).toHaveBeenCalledWith({ consecutive: 1, op: 'game' });
        reportError.mockRestore();
    });

    it('treats malformed settings acknowledgements as uncertain failed writes', async () => {
        const onWriteFail = vi.fn();
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        registerPersistenceWriteFailureHandler(onWriteFail);
        vi.mocked(desktopClient.saveSettings).mockResolvedValue({ undocumentedSetting: true });

        await expect(persistSaveSettings(createDefaultSaveData().settings)).rejects.toThrow('recognized field');
        expect(getSaveHealthSnapshot()).toMatchObject({
            status: 'transient_write_failed',
            consecutiveFailures: 1,
            operation: 'settings'
        });
        expect(onWriteFail).toHaveBeenCalledWith({ consecutive: 1, op: 'settings' });
        reportError.mockRestore();
    });
});
