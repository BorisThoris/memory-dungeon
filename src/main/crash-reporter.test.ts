import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CRASH_LOG_KEEP_COUNT } from './crash-log';
import { createCrashReporter, isFatalRendererExit, registerCrashHooks, type CrashHookTarget } from './crash-reporter';

const dirs: string[] = [];
const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'md-crash-'));
    dirs.push(dir);
    return dir;
};

afterEach(() => {
    while (dirs.length > 0) {
        rmSync(dirs.pop()!, { force: true, recursive: true });
    }
});

const reporterIn = (directory: string, startMs = Date.UTC(2026, 8, 3, 12)) => {
    let tick = 0;
    return createCrashReporter({
        appVersion: '1.2.3',
        directory,
        now: () => new Date(startMs + tick++ * 1_000),
        platform: 'linux'
    });
};

describe('createCrashReporter', () => {
    it('writes a readable record and creates the directory on the way', () => {
        const directory = join(tempDir(), 'nested', 'crash-logs');
        reporterIn(directory).record('main_uncaught', new Error('board build failed'));

        const files = readdirSync(directory);
        expect(files).toHaveLength(1);
        const text = readFileSync(join(directory, files[0]!), 'utf8');
        expect(text).toContain('Memory Dungeon crash report');
        expect(text).toContain('board build failed');
        expect(text).toContain('version:  1.2.3');
    });

    it('keeps only the newest logs', () => {
        const directory = tempDir();
        const reporter = reporterIn(directory);
        for (let i = 0; i < CRASH_LOG_KEEP_COUNT + 5; i += 1) {
            reporter.record('main_uncaught', new Error(`boom ${i}`));
        }
        expect(readdirSync(directory)).toHaveLength(CRASH_LOG_KEEP_COUNT);
        // The ones kept are the last ones written.
        const kept = readdirSync(directory).sort();
        const newest = readFileSync(join(directory, kept.at(-1)!), 'utf8');
        expect(newest).toContain(`boom ${CRASH_LOG_KEEP_COUNT + 4}`);
    });

    it('reports the crashes that were already there when it started, not its own', () => {
        const directory = tempDir();
        reporterIn(directory).record('main_uncaught', new Error('from an earlier launch'));

        const nextLaunch = reporterIn(directory, Date.UTC(2026, 8, 4, 12));
        expect(nextLaunch.priorCrashes.count).toBe(1);
        nextLaunch.record('main_uncaught', new Error('this launch'));
        expect(nextLaunch.priorCrashes.count).toBe(1);
    });

    it('sees no prior crashes on a first run, when the directory does not exist yet', () => {
        expect(reporterIn(join(tempDir(), 'not-created-yet')).priorCrashes).toEqual({ count: 0, latestFileName: null });
    });

    it('never throws while reporting, however broken the disk is', () => {
        const directory = tempDir();
        // A file where the directory should be: every write below will fail.
        const blocked = join(directory, 'blocked');
        writeFileSync(blocked, 'not a directory');
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(() => reporterIn(join(blocked, 'logs')).record('main_uncaught', new Error('boom'))).not.toThrow();
        expect(errors).toHaveBeenCalled();
    });
});

describe('isFatalRendererExit', () => {
    it('treats a real death as fatal and an ordinary shutdown as not', () => {
        for (const reason of ['crashed', 'oom', 'abnormal-exit', 'launch-failed', 'integrity-failure']) {
            expect(isFatalRendererExit(reason)).toBe(true);
        }
        for (const reason of ['clean-exit', 'killed', 'anything-else']) {
            expect(isFatalRendererExit(reason)).toBe(false);
        }
    });
});

describe('registerCrashHooks', () => {
    const collector = () => {
        const handlers = new Map<string, (...args: never[]) => void>();
        const target: CrashHookTarget = {
            on: (event, listener) => {
                handlers.set(event, listener);
                return target;
            }
        };
        return { handlers, target };
    };

    const wire = () => {
        const app = collector();
        const proc = collector();
        const records: Array<[string, unknown, string | null | undefined]> = [];
        registerCrashHooks(
            {
                directory: '/tmp/unused',
                priorCrashes: { count: 0, latestFileName: null },
                record: (kind, error, detail) => records.push([kind, error, detail])
            },
            { app: app.target, process: proc.target }
        );
        return { app, proc, records };
    };

    it('catches the main-process deaths that leave nothing behind today', () => {
        const { proc, records } = wire();
        proc.handlers.get('uncaughtException')!(new Error('thrown') as never);
        proc.handlers.get('unhandledRejection')!('rejected' as never);
        expect(records.map((row) => row[0])).toEqual(['main_uncaught', 'main_unhandled_rejection']);
    });

    it('records a renderer that died and ignores one that merely exited', () => {
        const { app, records } = wire();
        const gone = app.handlers.get('render-process-gone')!;
        gone(...([{}, {}, { exitCode: 133, reason: 'crashed' }] as unknown as never[]));
        gone(...([{}, {}, { exitCode: 0, reason: 'clean-exit' }] as unknown as never[]));
        expect(records).toHaveLength(1);
        expect(records[0]![0]).toBe('renderer_gone');
        expect(records[0]![2]).toBe('reason=crashed exitCode=133');
    });

    it('records a helper process that died, saying which one', () => {
        const { app, records } = wire();
        const gone = app.handlers.get('child-process-gone')!;
        gone(...([{}, { exitCode: 9, reason: 'oom', type: 'GPU' }] as unknown as never[]));
        expect(records[0]![0]).toBe('child_process_gone');
        expect(records[0]![2]).toBe('type=GPU reason=oom exitCode=9');
    });

    it('does not take the process down on an uncaught throw, which would lose the run in progress', () => {
        const { proc } = wire();
        expect(() => proc.handlers.get('uncaughtException')!(new Error('thrown') as never)).not.toThrow();
    });
});
