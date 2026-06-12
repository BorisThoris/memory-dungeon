import { describe, expect, it, vi } from 'vitest';
import { clearActiveTimer, createActiveTimer, getActiveTimerRemainingMs } from './activeTimer';

describe('activeTimer', () => {
    it('returns fallback when no timer is active', () => {
        expect(getActiveTimerRemainingMs(null, 125)).toBe(125);
        expect(getActiveTimerRemainingMs(null, null)).toBe(null);
    });

    it('reports non-negative remaining time', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1000);
        const timer = createActiveTimer(500, () => undefined);

        vi.setSystemTime(1700);

        expect(getActiveTimerRemainingMs(timer, null)).toBe(0);
        clearActiveTimer(timer);
        vi.useRealTimers();
    });

    it('clears scheduled timeout', () => {
        vi.useFakeTimers();
        const onElapsed = vi.fn();
        const timer = createActiveTimer(100, onElapsed);

        clearActiveTimer(timer);
        vi.advanceTimersByTime(100);

        expect(onElapsed).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});
