import { describe, expect, it } from 'vitest';
import {
    createSaveHealthSnapshot,
    getSaveHealthSnapshot,
    persistenceNoticeForConsecutiveFailures,
    saveHealthCopyForSnapshot
} from './persistBridge';

describe('REG-040 persistence health copy', () => {
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
});
