import { describe, expect, it } from 'vitest';
import {
    CRASH_LOG_KEEP_COUNT,
    crashLogFileName,
    describeCrash,
    formatCrashRecord,
    pruneCrashLogs,
    redactUserPaths,
    summarizePriorCrashes,
    type CrashRecord
} from './crash-log';

const context = {
    appVersion: '1.2.3',
    homeDir: '/home/ada',
    platform: 'linux',
    timestampIso: '2026-09-03T12:34:56.789Z'
} as const;

describe('redactUserPaths', () => {
    it('takes the account name out of a home directory it was told about', () => {
        expect(redactUserPaths('at /home/ada/games/md/main.js:12', '/home/ada')).toBe('at ~/games/md/main.js:12');
    });

    it('redacts a Windows home given with either separator', () => {
        const home = 'C:\\Users\\Ada';
        expect(redactUserPaths('at C:\\Users\\Ada\\md\\main.js', home)).toBe('at ~\\md\\main.js');
        expect(redactUserPaths('at C:/Users/Ada/md/main.js', home)).toBe('at ~/md/main.js');
    });

    it('redacts account names it was never told about, on every platform shape', () => {
        expect(redactUserPaths('C:\\Users\\Grace\\AppData\\md.log')).toBe('C:\\Users\\~\\AppData\\md.log');
        expect(redactUserPaths('/Users/grace/Library/md.log')).toBe('/Users/~/Library/md.log');
        expect(redactUserPaths('/home/grace/.config/md.log')).toBe('/home/~/.config/md.log');
    });

    it('leaves a path with no account name in it alone', () => {
        expect(redactUserPaths('/opt/memory-dungeon/resources/app.asar')).toBe('/opt/memory-dungeon/resources/app.asar');
    });

    it('handles several paths in one stack', () => {
        const stack = 'at /home/ada/a.js\n  at /home/bob/b.js';
        expect(redactUserPaths(stack, '/home/ada')).toBe('at ~/a.js\n  at /home/~/b.js');
    });

    it('is not fooled into redacting when there is no home to redact', () => {
        expect(redactUserPaths('plain message', null)).toBe('plain message');
        expect(redactUserPaths('plain message', '')).toBe('plain message');
    });
});

describe('describeCrash', () => {
    it('reads message and stack off a real error', () => {
        const error = new Error('board build failed');
        const record = describeCrash('main_uncaught', error, context);
        expect(record.kind).toBe('main_uncaught');
        expect(record.message).toBe('board build failed');
        expect(record.stack).toContain('board build failed');
        expect(record.appVersion).toBe('1.2.3');
        expect(record.timestampIso).toBe(context.timestampIso);
    });

    it('copes with whatever else a rejection might carry', () => {
        expect(describeCrash('main_unhandled_rejection', 'just a string', context).message).toBe('just a string');
        expect(describeCrash('main_unhandled_rejection', { code: 7 }, context).message).toBe('{"code":7}');
        expect(describeCrash('main_unhandled_rejection', undefined, context).message).toBe('undefined');
        expect(describeCrash('main_unhandled_rejection', null, context).stack).toBeNull();
    });

    it('survives an object that cannot be serialized', () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;
        expect(() => describeCrash('main_uncaught', circular, context)).not.toThrow();
    });

    it('redacts the home directory out of both the message and the stack', () => {
        const error = new Error('could not read /home/ada/save.json');
        error.stack = 'Error: could not read /home/ada/save.json\n    at /home/ada/app/main.js:1:1';
        const record = describeCrash('main_uncaught', error, context);
        expect(record.message).not.toContain('/home/ada');
        expect(record.stack).not.toContain('/home/ada');
        expect(record.stack).toContain('~/app/main.js');
    });

    it('bounds a message and a stack that would otherwise fill the disk', () => {
        const error = new Error('x'.repeat(5_000));
        error.stack = 'y'.repeat(50_000);
        const record = describeCrash('main_uncaught', error, context);
        expect(record.message.length).toBeLessThan(600);
        expect(record.stack!.length).toBeLessThan(4_100);
        expect(record.message).toContain('more characters');
    });

    it('keeps the caller context that the error itself does not carry', () => {
        const record = describeCrash('renderer_gone', new Error('gone'), { ...context, detail: 'reason=oom' });
        expect(record.detail).toBe('reason=oom');
        expect(describeCrash('renderer_gone', new Error('gone'), context).detail).toBeNull();
    });
});

describe('formatCrashRecord', () => {
    const record: CrashRecord = {
        appVersion: '1.2.3',
        detail: null,
        kind: 'startup_fatal',
        message: 'persistence unavailable',
        platform: 'win32',
        stack: 'Error: persistence unavailable\n    at start',
        timestampIso: '2026-09-03T12:34:56.789Z'
    };

    it('reads as something a player could paste into a bug report', () => {
        const text = formatCrashRecord(record);
        expect(text).toContain('Memory Dungeon crash report');
        expect(text).toContain('kind:     startup_fatal');
        expect(text).toContain('version:  1.2.3');
        expect(text).toContain('persistence unavailable');
    });

    it('leaves out the lines it has nothing for', () => {
        expect(formatCrashRecord(record)).not.toContain('detail:');
        expect(formatCrashRecord({ ...record, detail: 'reason=killed' })).toContain('detail:   reason=killed');
        expect(formatCrashRecord({ ...record, stack: null })).not.toContain('at start');
    });
});

describe('crashLogFileName', () => {
    const record = { kind: 'renderer_gone', timestampIso: '2026-09-03T12:34:56.789Z' } as CrashRecord;

    it('names a file Windows will accept, with the kind visible', () => {
        expect(crashLogFileName(record)).toBe('2026-09-03T12-34-56-renderer_gone.log');
        expect(crashLogFileName(record)).not.toContain(':');
    });

    it('sorts chronologically by name, which is what the pruning relies on', () => {
        const earlier = crashLogFileName({ ...record, timestampIso: '2026-09-03T11:00:00.000Z' } as CrashRecord);
        expect([crashLogFileName(record), earlier].sort()).toEqual([earlier, crashLogFileName(record)]);
    });
});

describe('pruneCrashLogs', () => {
    const names = Array.from(
        { length: 14 },
        (_unused, index) => `2026-09-${String(index + 1).padStart(2, '0')}T00-00-00-main_uncaught.log`
    );

    it('keeps nothing to delete while under the limit', () => {
        expect(pruneCrashLogs(names.slice(0, CRASH_LOG_KEEP_COUNT))).toEqual([]);
    });

    it('deletes the oldest once over the limit', () => {
        const sorted = [...names].sort();
        const doomed = pruneCrashLogs(sorted);
        expect(doomed).toEqual(sorted.slice(0, sorted.length - CRASH_LOG_KEEP_COUNT));
        expect(doomed.every((name) => !sorted.slice(-CRASH_LOG_KEEP_COUNT).includes(name))).toBe(true);
    });

    it('ignores whatever else is sitting in the directory', () => {
        expect(pruneCrashLogs(['notes.txt', '.DS_Store'], 0)).toEqual([]);
    });

    it('can be told to keep none', () => {
        expect(pruneCrashLogs(['a.log', 'b.log'], 0)).toEqual(['a.log', 'b.log']);
    });
});

describe('summarizePriorCrashes', () => {
    it('says nothing happened when nothing did', () => {
        expect(summarizePriorCrashes([])).toEqual({ count: 0, latestFileName: null });
        expect(summarizePriorCrashes(['readme.txt'])).toEqual({ count: 0, latestFileName: null });
    });

    it('counts the logs and points at the newest', () => {
        expect(summarizePriorCrashes(['2026-09-01T00-00-00-a.log', '2026-09-02T00-00-00-b.log', 'x.txt'])).toEqual({
            count: 2,
            latestFileName: '2026-09-02T00-00-00-b.log'
        });
    });
});
