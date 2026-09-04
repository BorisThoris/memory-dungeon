import type { RunHistoryRecord } from '../../shared/contracts';

/**
 * How a past run reads on the Profile screen.
 *
 * A date rather than a relative age: "3 days ago" needs a clock the moment it is read and goes
 * stale while the screen is open, and a player comparing two runs wants the day, not the distance.
 */

export const RUN_HISTORY_COPY = {
    copy: 'Copy',
    copyAriaLabel: (record: RunHistoryRecord): string =>
        `Copy the key for the ${record.mode} run that reached floor ${record.highestLevel}`,
    copyDone: 'Copied',
    copyFailed: 'Failed',
    best: 'Best',
    bestAriaLabel: 'Your highest scoring recorded run',
    empty: 'Finished runs are recorded here.',
    label: 'Recent runs',
    /** `Floor 12 · 3,400` — the two numbers a player compares runs by. */
    result: (record: RunHistoryRecord): string =>
        `Floor ${record.highestLevel} · ${record.totalScore.toLocaleString('en-US')}`
} as const;

/** `4 Sep 2026`, in the player's own locale ordering. An unreadable instant reads as blank. */
export const formatRunHistoryDate = (endedAtIso: string): string => {
    const at = new Date(endedAtIso);
    if (Number.isNaN(at.getTime())) {
        return '';
    }
    return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
