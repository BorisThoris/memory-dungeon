/**
 * The study period is a gift of time, and a gift you cannot refuse is a wait.
 *
 * A player who has already read the board wants to start, and until now the only way to do that
 * was to sit and watch the rest of the clock. A single tap cannot end it — the board is the thing
 * being studied, and a stray touch on it must not cost the player the phase they are still using.
 * Two taps inside a short window is the deliberate version of the same gesture, so that is what
 * ends the phase.
 */
export const MEMORIZE_SKIP_TAP_WINDOW_MS = 450;

export interface MemorizeSkipTapState {
    /** When the first half of a pending double tap landed, or null when no tap is pending. */
    readonly lastTapAtMs: number | null;
}

export const createMemorizeSkipTapState = (): MemorizeSkipTapState => ({ lastTapAtMs: null });

export interface MemorizeSkipTapResult {
    readonly state: MemorizeSkipTapState;
    readonly skip: boolean;
}

/**
 * Feeds one tap to the gesture. A second tap inside the window skips and clears the state, so a
 * third tap starts a fresh pair rather than skipping again into a phase that is already over.
 */
export const registerMemorizeSkipTap = (
    state: MemorizeSkipTapState,
    nowMs: number
): MemorizeSkipTapResult => {
    const pending = state.lastTapAtMs;
    const withinWindow =
        pending !== null && nowMs >= pending && nowMs - pending <= MEMORIZE_SKIP_TAP_WINDOW_MS;

    return withinWindow
        ? { state: createMemorizeSkipTapState(), skip: true }
        : { state: { lastTapAtMs: nowMs }, skip: false };
};
