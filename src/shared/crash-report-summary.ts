import type { CrashReportSummary } from './contracts';

/**
 * Turning the crash-log folder into something a player can act on.
 *
 * Reports never leave the machine, which is the right default and also the reason this matters: a
 * log nobody can find is the same as no log. Someone writing to support needs to be told there are
 * reports and where they are, in that order.
 *
 * Deliberately not a menu banner. A player who crashed once should not be reminded of it on every
 * launch; Settings is where somebody goes when they want to know what went wrong.
 */
export const normalizeCrashReportSummary = (input: unknown): CrashReportSummary => {
    const value = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
    const count = typeof value.count === 'number' && Number.isFinite(value.count) ? Math.max(0, Math.floor(value.count)) : 0;
    return {
        count,
        directory: typeof value.directory === 'string' ? value.directory : '',
        latestFileName: typeof value.latestFileName === 'string' ? value.latestFileName : null
    };
};

/** The Settings line, or null when there is nothing to say. */
export const describeCrashReports = (summary: CrashReportSummary): string | null => {
    if (summary.count <= 0) {
        return null;
    }
    const reports = summary.count === 1 ? '1 crash report' : `${summary.count} crash reports`;
    // Naming the folder is the whole point: without it the count is just bad news with no action.
    return summary.directory.length > 0
        ? `${reports} from earlier sessions, in ${summary.directory}`
        : `${reports} from earlier sessions.`;
};
