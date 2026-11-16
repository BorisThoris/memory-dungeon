import { tr } from '../../shared/i18n';
import type { SuspendedRunSummary } from '../store/suspendedRun';

/** What the menu says about a run put down mid-way (`suspendedRun.ts`). */
export const SUSPENDED_RUN_COPY = {
    note: (run: SuspendedRunSummary): string =>
        tr`${run.passAndPlay ? tr.s('Pass and Play · ') : ''}Floor ${run.floor} · ${run.score.toLocaleString('en')} score`
} as const;
