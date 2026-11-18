import type { RunState } from '../../shared/contracts';

/*
 * An assisted run (owner, 2026-11-18): pair-distance hints show where a card's match lies, so a run
 * that had them on at any point is labelled in history and kept off the global record. Sticky:
 * turning them off mid-run does not unlabel it.
 *
 * Tracked here rather than on the live run: the run object is replaced only by the rules, and
 * rewriting it from a store listener would break every check that a no-op left it alone. The flag
 * reaches the run once, when it ends (`runResolutionController`).
 */
let assistedThisRun = false;

/** A run begins when there was none, or the last one was over. */
const isRunStart = (previous: RunState | null, next: RunState): boolean =>
    next.status !== 'gameOver' && (previous === null || previous.status === 'gameOver');

export const trackRunAssist = (previous: RunState | null, next: RunState | null, hintsOn: boolean): void => {
    if (!next) return;
    if (isRunStart(previous, next)) assistedThisRun = false;
    if (hintsOn && next.status !== 'gameOver') assistedThisRun = true;
};

export const wasRunAssisted = (): boolean => assistedThisRun;

/** The run as it ended, marked when hints were on at any point in it. */
export const withRunAssist = <T extends RunState>(run: T): T => (assistedThisRun ? { ...run, assisted: true } : run);
