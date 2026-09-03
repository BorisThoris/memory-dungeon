/**
 * The side-effecting half of crash reporting: where files go, and which deaths get caught.
 *
 * Nothing here is sent over a network. `crash-log.ts` decides what a record contains; this decides
 * where it lands and wires the process events that would otherwise let a crash pass unrecorded.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { App, WebContents } from 'electron';
import {
    CRASH_LOG_DIR_NAME,
    crashLogFileName,
    describeCrash,
    formatCrashRecord,
    pruneCrashLogs,
    summarizePriorCrashes,
    type CrashKind,
    type PriorCrashSummary
} from './crash-log';

export interface CrashReporter {
    /** Where the logs live, so the app can tell a player where to look. */
    readonly directory: string;
    /** Crashes already on disk when this launch began — the ones worth mentioning. */
    readonly priorCrashes: PriorCrashSummary;
    record: (kind: CrashKind, error: unknown, detail?: string | null) => void;
}

const listLogFiles = (directory: string): string[] => {
    try {
        return readdirSync(directory);
    } catch {
        return [];
    }
};

export interface CrashReporterOptions {
    readonly appVersion: string;
    readonly directory: string;
    readonly now?: () => Date;
    readonly platform?: string;
}

export const createCrashReporter = ({
    appVersion,
    directory,
    now = () => new Date(),
    platform = process.platform
}: CrashReporterOptions): CrashReporter => {
    // Read the prior crashes before this launch can add any, or the count includes our own.
    const priorCrashes = summarizePriorCrashes(listLogFiles(directory));

    const record = (kind: CrashKind, error: unknown, detail?: string | null): void => {
        try {
            const crash = describeCrash(kind, error, {
                appVersion,
                detail: detail ?? null,
                homeDir: homedir(),
                platform,
                timestampIso: now().toISOString()
            });
            mkdirSync(directory, { recursive: true });
            writeFileSync(join(directory, crashLogFileName(crash)), formatCrashRecord(crash), 'utf8');
            for (const stale of pruneCrashLogs(listLogFiles(directory))) {
                rmSync(join(directory, stale), { force: true });
            }
        } catch (writeError) {
            // A crash reporter that throws while reporting a crash is worse than no reporter.
            console.error('[crash] could not write crash log', writeError);
        }
    };

    return { directory, priorCrashes, record };
};

export const crashLogDirectoryFor = (app: Pick<App, 'getPath'>): string =>
    join(app.getPath('userData'), CRASH_LOG_DIR_NAME);

/** Electron's `render-process-gone` reasons that mean something actually went wrong. */
const FATAL_RENDERER_REASONS = new Set(['crashed', 'oom', 'abnormal-exit', 'launch-failed', 'integrity-failure']);

export const isFatalRendererExit = (reason: string): boolean => FATAL_RENDERER_REASONS.has(reason);

export interface CrashHookTarget {
    on: (event: string, listener: (...args: never[]) => void) => unknown;
}

/**
 * Register the handlers for the deaths that currently leave nothing behind: an uncaught throw or a
 * rejected promise in the main process, and a renderer or helper process going away.
 *
 * `uncaughtException` is deliberately not re-thrown. Electron's default for an unhandled throw is
 * to take the process down, and doing that on, say, a failed settings write would lose the run a
 * player is in the middle of. The record is written and the game carries on.
 */
export const registerCrashHooks = (
    reporter: CrashReporter,
    hooks: { app: CrashHookTarget; process: CrashHookTarget }
): void => {
    hooks.process.on('uncaughtException', ((error: unknown) => {
        reporter.record('main_uncaught', error);
    }) as (...args: never[]) => void);

    hooks.process.on('unhandledRejection', ((reason: unknown) => {
        reporter.record('main_unhandled_rejection', reason);
    }) as (...args: never[]) => void);

    hooks.app.on('render-process-gone', ((
        _event: unknown,
        _contents: WebContents,
        details: { exitCode?: number; reason: string }
    ) => {
        if (!isFatalRendererExit(details.reason)) {
            return;
        }
        reporter.record(
            'renderer_gone',
            new Error(`Renderer process gone: ${details.reason}`),
            `reason=${details.reason} exitCode=${details.exitCode ?? 'unknown'}`
        );
    }) as (...args: never[]) => void);

    hooks.app.on('child-process-gone', ((
        _event: unknown,
        details: { exitCode?: number; reason: string; type?: string }
    ) => {
        if (!isFatalRendererExit(details.reason)) {
            return;
        }
        reporter.record(
            'child_process_gone',
            new Error(`Child process gone: ${details.type ?? 'unknown'} (${details.reason})`),
            `type=${details.type ?? 'unknown'} reason=${details.reason} exitCode=${details.exitCode ?? 'unknown'}`
        );
    }) as (...args: never[]) => void);
};
