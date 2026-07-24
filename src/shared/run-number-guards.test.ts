import { describe, expect, it } from 'vitest';
import {
    decrementRunCounter,
    runFiniteNumber,
    runFiniteNumberOrNull,
    runFiniteIntegerDelta,
    runNonNegativeInteger,
    runNonNegativeIntegerOrFallback,
    runNonNegativeIntegerOrNull,
    runNonNegativeIntegerWithFallback
} from './run-number-guards';

describe('run number guards', () => {
    it('normalizes runtime numbers without rounding finite values', () => {
        expect(runFiniteNumber(2.9)).toBe(2.9);
        expect(runFiniteNumber(-1.9)).toBe(-1.9);
        expect(runFiniteNumber(Number.NaN)).toBe(0);
        expect(runFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0);
        expect(runFiniteNumberOrNull(2.9)).toBe(2.9);
        expect(runFiniteNumberOrNull(Number.NaN)).toBeNull();
        expect(runFiniteNumberOrNull(null)).toBeNull();
    });

    it('normalizes runtime counters to non-negative integers', () => {
        expect(runNonNegativeInteger(2.9)).toBe(2);
        expect(runNonNegativeInteger(-1.9)).toBe(0);
        expect(runNonNegativeInteger(Number.NaN)).toBe(0);
        expect(runNonNegativeInteger(Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('normalizes signed integer deltas without allowing non-finite values', () => {
        expect(runFiniteIntegerDelta(2.9)).toBe(2);
        expect(runFiniteIntegerDelta(-1.9)).toBe(-1);
        expect(runFiniteIntegerDelta(Number.NaN)).toBe(0);
        expect(runFiniteIntegerDelta(Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('uses a normalized fallback when runtime counters are malformed', () => {
        expect(runNonNegativeIntegerWithFallback(4.9, 1)).toBe(4);
        expect(runNonNegativeIntegerWithFallback(Number.NaN, 3.9)).toBe(3);
        expect(runNonNegativeIntegerWithFallback(Number.POSITIVE_INFINITY, -1)).toBe(0);
    });

    it('preserves the exact fallback when runtime counters are malformed', () => {
        expect(runNonNegativeIntegerOrFallback(4.9, 1)).toBe(4);
        expect(runNonNegativeIntegerOrFallback(Number.NaN, 3.9)).toBe(3.9);
        expect(runNonNegativeIntegerOrFallback(Number.POSITIVE_INFINITY, Number.NaN)).toBeNaN();
    });

    it('uses null for unavailable runtime counters', () => {
        expect(runNonNegativeIntegerOrNull(4.9)).toBe(4);
        expect(runNonNegativeIntegerOrNull(-1.9)).toBe(0);
        expect(runNonNegativeIntegerOrNull(Number.NaN)).toBeNull();
        expect(runNonNegativeIntegerOrNull(null)).toBeNull();
    });

    it('decrements runtime counters without going below zero', () => {
        expect(decrementRunCounter(3.9)).toBe(2);
        expect(decrementRunCounter(3, 2.9)).toBe(1);
        expect(decrementRunCounter(1, 4)).toBe(0);
        expect(decrementRunCounter(Number.NaN)).toBe(0);
        expect(decrementRunCounter(3, Number.POSITIVE_INFINITY)).toBe(3);
    });
});
