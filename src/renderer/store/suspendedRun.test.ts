import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewRun } from '../../shared/game-core';
import { createDefaultSaveData } from '../../shared/save-data';
import {
    clearSuspendedRun,
    readSuspendedRun,
    SUSPENDED_RUN_FORMAT,
    SUSPENDED_RUN_STORAGE_KEY,
    summarizeSuspendedRun,
    writeSuspendedRun
} from './suspendedRun';

describe('a run put down and picked up again', () => {
    beforeEach(() => window.localStorage.clear());

    it('keeps a run in play exactly, and says where it stands', () => {
        const run = createNewRun(1200, { runSeed: 41 });
        expect(writeSuspendedRun(run, createDefaultSaveData(), 1_000)).toBe(true);
        const read = readSuspendedRun();
        expect(read?.run).toEqual(run);
        expect(read?.savedAt).toBe(1_000);
        expect(summarizeSuspendedRun(read)).toEqual({ floor: run.board!.level, score: run.stats.totalScore, savedAt: 1_000, passAndPlay: false });
    });

    it('keeps nothing for a run that is over, and forgets one once cleared', () => {
        const run = createNewRun(0, { runSeed: 7 });
        expect(writeSuspendedRun({ ...run, status: 'gameOver' }, null)).toBe(false);
        expect(readSuspendedRun()).toBeNull();
        writeSuspendedRun(run, null);
        clearSuspendedRun();
        expect(readSuspendedRun()).toBeNull();
    });

    it('drops a snapshot it cannot trust rather than handing it to the board', () => {
        window.localStorage.setItem(SUSPENDED_RUN_STORAGE_KEY, '{"format":1,"run":{"status":"playing"}');
        expect(readSuspendedRun()).toBeNull();
        expect(window.localStorage.getItem(SUSPENDED_RUN_STORAGE_KEY)).toBeNull();
        const run = createNewRun(0, { runSeed: 7 });
        window.localStorage.setItem(SUSPENDED_RUN_STORAGE_KEY, JSON.stringify({ format: SUSPENDED_RUN_FORMAT + 1, savedAt: 1, run, runStartSaveData: null }));
        expect(readSuspendedRun()).toBeNull();
    });

    it('lets the run play on when storage is full', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
            throw new DOMException('full', 'QuotaExceededError');
        });
        expect(writeSuspendedRun(createNewRun(0, { runSeed: 7 }), null)).toBe(false);
        expect(warn).toHaveBeenCalled();
        setItem.mockRestore();
        warn.mockRestore();
    });
});
