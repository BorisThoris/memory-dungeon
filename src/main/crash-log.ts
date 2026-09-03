/**
 * What the game leaves behind when it dies.
 *
 * There is no backend and no telemetry consent flow, so nothing here is sent anywhere: a crash
 * writes a bounded, redacted record next to the save file, and the next launch tells the player it
 * is there. That is the honest version of "we have crash reporting" for a build in this shape — a
 * player who hits a bug can attach the file to a report instead of describing a window that
 * vanished.
 *
 * Everything that decides *what* gets written is pure and lives here, because the part worth
 * testing is the redaction and the bounds, not the call to `writeFile`.
 */

export type CrashKind =
    | 'main_uncaught'
    | 'main_unhandled_rejection'
    | 'renderer_gone'
    | 'child_process_gone'
    | 'startup_fatal';

export interface CrashRecord {
    readonly appVersion: string;
    /** Extra context the caller has and the error does not — an exit reason, a child process type. */
    readonly detail: string | null;
    readonly kind: CrashKind;
    readonly message: string;
    readonly platform: string;
    readonly stack: string | null;
    readonly timestampIso: string;
}

/** A stack trace can be enormous and a message can be a whole serialized object. Neither helps. */
const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4_000;
const MAX_DETAIL_LENGTH = 200;

/** How many crash files to keep. Enough to see a pattern, not enough to fill a disk. */
export const CRASH_LOG_KEEP_COUNT = 10;

export const CRASH_LOG_DIR_NAME = 'crash-logs';

const truncate = (value: string, limit: number): string =>
    value.length <= limit ? value : `${value.slice(0, limit)}… [${value.length - limit} more characters]`;

/**
 * Stack traces are full of absolute paths, and on every desktop platform the absolute path to a
 * game contains the player's account name. A player pasting a crash log into a public issue should
 * not be publishing that, so the home directory goes before anything is written.
 */
export const redactUserPaths = (text: string, homeDir?: string | null): string => {
    let out = text;
    if (homeDir && homeDir.length > 2) {
        // Both separators: a Windows path can reach a log through either.
        for (const variant of [homeDir, homeDir.replaceAll('\\', '/'), homeDir.replaceAll('/', '\\')]) {
            out = out.split(variant).join('~');
        }
    }
    // Whoever the crash belonged to, the shape of these is the same on every machine.
    out = out.replace(/([A-Za-z]:[\\/]Users[\\/])[^\\/\s"')\]]+/gu, '$1~');
    out = out.replace(/(\/Users\/)[^/\s"')\]]+/gu, '$1~');
    out = out.replace(/(\/home\/)[^/\s"')\]]+/gu, '$1~');
    return out;
};

const errorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message || error.name || 'Error';
    }
    if (typeof error === 'string') {
        return error;
    }
    try {
        return JSON.stringify(error) ?? String(error);
    } catch {
        return String(error);
    }
};

export interface DescribeCrashContext {
    readonly appVersion: string;
    readonly detail?: string | null;
    readonly homeDir?: string | null;
    readonly platform: string;
    readonly timestampIso: string;
}

/** Turn whatever was thrown into a record that is safe to write and bounded in size. */
export const describeCrash = (kind: CrashKind, error: unknown, context: DescribeCrashContext): CrashRecord => {
    const redact = (value: string): string => redactUserPaths(value, context.homeDir);
    const rawStack = error instanceof Error && typeof error.stack === 'string' ? error.stack : null;
    return {
        appVersion: context.appVersion,
        detail: context.detail ? truncate(redact(context.detail), MAX_DETAIL_LENGTH) : null,
        kind,
        message: truncate(redact(errorMessage(error)), MAX_MESSAGE_LENGTH),
        platform: context.platform,
        stack: rawStack ? truncate(redact(rawStack), MAX_STACK_LENGTH) : null,
        timestampIso: context.timestampIso
    };
};

/** Sorts and reads as plain text, because the person opening it is a player, not a service. */
export const formatCrashRecord = (record: CrashRecord): string =>
    [
        `Memory Dungeon crash report`,
        `when:     ${record.timestampIso}`,
        `kind:     ${record.kind}`,
        `version:  ${record.appVersion}`,
        `platform: ${record.platform}`,
        ...(record.detail ? [`detail:   ${record.detail}`] : []),
        ``,
        record.message,
        ...(record.stack ? [``, record.stack] : []),
        ``
    ].join('\n');

/** Timestamped so the newest sorts last by name, and safe on Windows, which rejects a colon. */
export const crashLogFileName = (record: CrashRecord): string =>
    `${record.timestampIso.replaceAll(':', '-').replace(/\..*$/u, '')}-${record.kind}.log`;

const isCrashLogName = (name: string): boolean => name.endsWith('.log');

/**
 * Which files to delete so only the newest `keep` remain. Names lead with an ISO timestamp, so
 * lexicographic order is chronological order and no file has to be opened to sort them.
 */
export const pruneCrashLogs = (fileNames: readonly string[], keep = CRASH_LOG_KEEP_COUNT): string[] => {
    const logs = fileNames.filter(isCrashLogName).sort();
    return logs.slice(0, Math.max(0, logs.length - Math.max(0, keep)));
};

/** What the next launch needs to know: how many crashes are on disk and which was the last. */
export interface PriorCrashSummary {
    readonly count: number;
    readonly latestFileName: string | null;
}

export const summarizePriorCrashes = (fileNames: readonly string[]): PriorCrashSummary => {
    const logs = fileNames.filter(isCrashLogName).sort();
    return { count: logs.length, latestFileName: logs.at(-1) ?? null };
};
