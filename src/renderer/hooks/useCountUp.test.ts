import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COUNT_UP_MS, countUpValue, useCountUp } from './useCountUp';

describe('countUpValue', () => {
    it('starts on the old number and lands exactly on the new one', () => {
        expect(countUpValue(70, 575, 0)).toBe(70);
        expect(countUpValue(70, 575, COUNT_UP_MS)).toBe(575);
        expect(countUpValue(70, 575, COUNT_UP_MS * 4)).toBe(575);
    });

    it('eases out: most of the distance goes in the first half', () => {
        const half = countUpValue(0, 1000, COUNT_UP_MS / 2);
        expect(half).toBeGreaterThan(800);
        expect(half).toBeLessThan(1000);
        // And it only ever moves toward the target, in whole numbers.
        let previous = 0;
        for (let elapsed = 0; elapsed <= COUNT_UP_MS; elapsed += 10) {
            const value = countUpValue(0, 1000, elapsed);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
    });

    it('counts down the same way when the number falls', () => {
        expect(countUpValue(500, 200, 0)).toBe(500);
        expect(countUpValue(500, 200, COUNT_UP_MS / 2)).toBeLessThan(300);
        expect(countUpValue(500, 200, COUNT_UP_MS)).toBe(200);
    });
});

describe('useCountUp', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('shows the mounted value at once and counts to the next one over the duration', () => {
        const { result, rerender } = renderHook(({ value }: { value: number }) => useCountUp(value), {
            initialProps: { value: 70 }
        });
        expect(result.current).toBe(70);

        rerender({ value: 575 });
        expect(result.current).toBe(70);

        act(() => {
            vi.advanceTimersByTime(COUNT_UP_MS / 2);
        });
        expect(result.current).toBeGreaterThan(70);
        expect(result.current).toBeLessThan(575);

        act(() => {
            vi.advanceTimersByTime(COUNT_UP_MS);
        });
        expect(result.current).toBe(575);
    });

    it('restarts from the number on screen when the target moves mid-count', () => {
        const { result, rerender } = renderHook(({ value }: { value: number }) => useCountUp(value), {
            initialProps: { value: 0 }
        });
        rerender({ value: 1000 });
        act(() => {
            vi.advanceTimersByTime(COUNT_UP_MS / 2);
        });
        const midway = result.current;
        expect(midway).toBeGreaterThan(0);

        rerender({ value: 2000 });
        expect(result.current).toBe(midway);
        act(() => {
            vi.advanceTimersByTime(COUNT_UP_MS + 50);
        });
        expect(result.current).toBe(2000);
    });

    it('keeps every number exact under reduced motion', () => {
        const { result, rerender } = renderHook(
            ({ value }: { value: number }) => useCountUp(value, { reduceMotion: true }),
            { initialProps: { value: 70 } }
        );
        rerender({ value: 575 });
        expect(result.current).toBe(575);
    });
});
