import { describe, expect, it } from 'vitest';
import { runFiniteIntegerDelta, runNonNegativeInteger, runNonNegativeIntegerWithFallback } from './run-number-guards';

describe('run number guards', () => {
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
});
