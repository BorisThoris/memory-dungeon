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

/**
 * Per-mode records on Profile. Separate from the run list because they answer a different
 * question: not "what did I do lately" but "how well have I ever done at this".
 */
export const MODE_RECORDS_COPY = {
    empty: 'A record appears here for each mode you finish a run in.',
    label: 'Records by mode',
    /** `2,200 · floor 12` — the record itself. */
    result: (totalScore: number, highestLevel: number): string =>
        `${totalScore.toLocaleString('en-US')} · floor ${highestLevel}`,
    /** `4 runs` under the record, so a one-off does not read like a long campaign. */
    runs: (runs: number): string => `${runs} ${runs === 1 ? 'run' : 'runs'}`,
    /** `Chain ×12 · chunk of 7` — the chain's own records for the mode; nothing when the mode has none. */
    chain: (bestChain: number, biggestChunk: number): string | null => {
        const parts = [
            bestChain > 0 ? `Chain ×${bestChain}` : null,
            biggestChunk > 0 ? `chunk of ${biggestChunk}` : null
        ].filter((part): part is string => part !== null);
        return parts.length === 0 ? null : parts.join(' · ');
    }
} as const;

/**
 * The three ways to read your own record, in one paged region rather than three stacked lists.
 *
 * They were three sections, each rendering everything it had. On a profile with twenty recorded
 * runs that pushed thirteen of them — the best one included — past the bottom of the screen, on a
 * screen whose whole contract is that it fits. Stacked paged regions do not work either: at 812×375
 * each one measured 25px of frame and drew a full-height card into it. One region at a time gets
 * the whole budget, and the window decides how many rows are on screen.
 */
export const PROFILE_LEDGER_VIEWS = ['progress', 'runs', 'records'] as const;

export type ProfileLedgerView = (typeof PROFILE_LEDGER_VIEWS)[number];

export const PROFILE_LEDGER_COPY = {
    label: 'Your record',
    tab: {
        progress: 'In progress',
        records: 'By mode',
        runs: 'Recent runs'
    } satisfies Record<ProfileLedgerView, string>,
    tabAriaLabel: 'Which part of your record to show'
} as const;
