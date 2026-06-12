export interface ActiveTimer {
    deadline: number;
    timeout: ReturnType<typeof setTimeout>;
}

export const clearActiveTimer = (timer: ActiveTimer | null): void => {
    if (timer) {
        clearTimeout(timer.timeout);
    }
};

export const createActiveTimer = (duration: number, onElapsed: () => void): ActiveTimer => ({
    deadline: Date.now() + duration,
    timeout: setTimeout(onElapsed, duration)
});

export const getActiveTimerRemainingMs = (timer: ActiveTimer | null, fallback: number | null): number | null => {
    if (!timer) {
        return fallback;
    }

    return Math.max(timer.deadline - Date.now(), 0);
};
