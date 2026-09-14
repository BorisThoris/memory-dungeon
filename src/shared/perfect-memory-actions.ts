import type { PerfectMemoryAction, RunState } from './contracts';

/** Apply only after an assist succeeds. Keep unknown earlier history unknown. */
export const recordPerfectMemoryAction = (
    run: RunState,
    action: PerfectMemoryAction
): Pick<RunState, 'powersUsedThisRun' | 'perfectMemoryActions'> => ({
    powersUsedThisRun: true,
    perfectMemoryActions: {
        first: run.powersUsedThisRun ? run.perfectMemoryActions?.first ?? null : action,
        latest: action
    }
});
