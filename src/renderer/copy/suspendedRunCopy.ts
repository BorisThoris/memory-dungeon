import type { SuspendedRunSummary } from '../store/suspendedRun';

/** What the menu says about a run put down mid-way (`suspendedRun.ts`). */
export const SUSPENDED_RUN_COPY = {
    note: (run: SuspendedRunSummary): string =>
        `${run.passAndPlay ? 'Pass and Play · ' : ''}Floor ${run.floor} · ${run.score.toLocaleString('en')} score`
} as const;
