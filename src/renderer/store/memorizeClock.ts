/**
 * When the study clock actually started, for the HUD's count.
 *
 * The store starts the memorize timer only once the board reports itself dealt
 * (`notifyMemorizeBoardReady`), but the HUD began counting the moment the status became
 * `memorize`: through the veil and the deal-in it ran about a second ahead of the real clock, then
 * sat on its last second while the real one caught up (recorded 2026-10-16). The timer controller
 * publishes the start here and the HUD counts from it, holding the full study time until then.
 */
export interface MemorizeClock {
    /** `Date.now()` when the timer was scheduled. */
    startedAt: number;
    /** What it was scheduled for. */
    durationMs: number;
}

let current: MemorizeClock | null = null;
const listeners = new Set<() => void>();

export const getMemorizeClock = (): MemorizeClock | null => current;

export const setMemorizeClock = (next: MemorizeClock | null): void => {
    if (current === next) return;
    current = next;
    for (const listener of listeners) listener();
};

export const subscribeMemorizeClock = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
