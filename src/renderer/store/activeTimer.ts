export interface ActiveTimer {
    deadline: number;
    timeout: ReturnType<typeof setTimeout>;
}

export const clearActiveTimer = (timer: ActiveTimer | null): void => {
    if (timer) {
        clearTimeout(timer.timeout);
    }
};

const normalizeTimerDuration = (duration: number): number =>
    Number.isFinite(duration) ? Math.max(0, Math.floor(duration)) : 0;

export const createActiveTimer = (duration: number, onElapsed: () => void): ActiveTimer => {
    const safeDuration = normalizeTimerDuration(duration);
    return {
        deadline: Date.now() + safeDuration,
        timeout: setTimeout(onElapsed, safeDuration)
    };
};

export const getActiveTimerRemainingMs = (timer: ActiveTimer | null, fallback: number | null): number | null => {
    if (!timer) {
        return fallback;
    }

    const remaining = timer.deadline - Date.now();
    return Number.isFinite(remaining) ? Math.max(remaining, 0) : fallback;
};
