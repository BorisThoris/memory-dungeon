import { describe, expect, it } from 'vitest';
import { describeCrashReports, normalizeCrashReportSummary } from './crash-report-summary';

/**
 * Crash reports never leave the machine. That is the right default, and it is exactly why this
 * matters: a log nobody can find is the same as no log. Before this, the only consumer of the
 * summary was a console.warn in the main process, which no player has ever read.
 */
describe('describing crash reports for the player', () => {
    it('names the folder, because a count alone is bad news with no action', () => {
        const line = describeCrashReports({
            count: 3,
            directory: '/home/p/.config/Memory Dungeon/crash-logs',
            latestFileName: 'crash-2026-09-03.log'
        });

        expect(line).toContain('3 crash reports');
        expect(line).toContain('/home/p/.config/Memory Dungeon/crash-logs');
    });

    it('counts one report as one', () => {
        const line = describeCrashReports({ count: 1, directory: '/logs', latestFileName: 'a.log' });

        expect(line).toContain('1 crash report ');
        expect(line).not.toContain('1 crash reports');
    });

    it('says nothing at all when nothing has gone wrong', () => {
        expect(describeCrashReports({ count: 0, directory: '/logs', latestFileName: null })).toBeNull();
    });

    it('still reports the count when the folder is unknown', () => {
        const line = describeCrashReports({ count: 2, directory: '', latestFileName: null });

        expect(line).toContain('2 crash reports');
        expect(line).not.toContain('in ');
    });
});

describe('normalizing the summary off the wire', () => {
    it('accepts a well-formed summary', () => {
        expect(normalizeCrashReportSummary({ count: 2, directory: '/logs', latestFileName: 'a.log' })).toEqual({
            count: 2,
            directory: '/logs',
            latestFileName: 'a.log'
        });
    });

    it('treats anything else as nothing to report rather than throwing', () => {
        for (const input of [null, undefined, 'nope', 42, { count: -5 }, { count: Number.NaN }]) {
            const summary = normalizeCrashReportSummary(input);

            expect(summary.count).toBe(0);
            expect(describeCrashReports(summary)).toBeNull();
        }
    });
});
