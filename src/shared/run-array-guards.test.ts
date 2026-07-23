import { describe, expect, it } from 'vitest';
import { runArrayCount, runStringArray } from './run-array-guards';

describe('run array guards', () => {
    it('passes through runtime string arrays and treats malformed values as empty', () => {
        const ids = ['a1', 'b2'];

        expect(runStringArray(ids)).toBe(ids);
        expect(runStringArray(Number.NaN)).toEqual([]);
        expect(runStringArray(null)).toEqual([]);
    });

    it('counts array values without coercing array-like objects', () => {
        expect(runArrayCount(['a', 'b'])).toBe(2);
        expect(runArrayCount({ length: Number.POSITIVE_INFINITY })).toBe(0);
        expect(runArrayCount(Number.NaN)).toBe(0);
    });
});
