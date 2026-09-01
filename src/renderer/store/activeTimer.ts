import { runNonNegativeInteger } from '../../shared/run-number-guards';

export interface ActiveTimer {
    deadline: number;
    timeout: ReturnType<typeof setTimeout>;
}

export const clearActiveTimer = (timer: ActiveTimer | null): void => {
    if (timer) {
        clearTimeout(timer.timeout);
    }
};

const normalizeTimerDuration = (duration: number): number => runNonNegativeInteger(duration);

export const createActiveTimer = (duration: number, onElapsed: () => void): ActiveTimer => {
    const safeDuration = normalizeTimerDuration(duration);
    return {
        deadline: Date.now() + safeDuration,
        timeout: setTimeout(onElapsed, safeDuration)
    };
};

/**
 * `observedAtMs` lets a caller measure several timers against one instant. Pausing
 * reads the memorize, resolve and debug-reveal timers together, and sampling
 * `Date.now()` separately per timer would let them drift apart mid-snapshot.
 */
export const getActiveTimerRemainingMs = (
    timer: ActiveTimer | null,
    fallback: number | null,
    observedAtMs: number = Date.now()
): number | null => {
    if (!timer) {
        return fallback;
    }

    const remaining = timer.deadline - observedAtMs;
    return Number.isFinite(remaining) ? Math.max(remaining, 0) : fallback;
};
