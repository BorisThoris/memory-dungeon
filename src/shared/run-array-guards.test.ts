import { describe, expect, it } from 'vitest';
import { runArray, runArrayCount, runFilteredArray, runFilteredStringArray, runFilteredStringArrayOrNull, runStringArray } from './run-array-guards';

describe('run array guards', () => {
    it('passes through runtime string arrays and treats malformed values as empty', () => {
        const ids = ['a1', 'b2'];

        expect(runArray<string>(ids)).toBe(ids);
        expect(runArray<string>(Number.NaN)).toEqual([]);
        expect(runStringArray(ids)).toBe(ids);
        expect(runStringArray(Number.NaN)).toEqual([]);
        expect(runStringArray(null)).toEqual([]);
    });

    it('counts array values without coercing array-like objects', () => {
        expect(runArrayCount(['a', 'b'])).toBe(2);
        expect(runArrayCount({ length: Number.POSITIVE_INFINITY })).toBe(0);
        expect(runArrayCount(Number.NaN)).toBe(0);
    });

    it('filters runtime arrays to string values', () => {
        expect(runFilteredStringArray(['a', 1, 'b', null])).toEqual(['a', 'b']);
        expect(runFilteredStringArray(Number.NaN)).toEqual([]);
        expect(runFilteredStringArrayOrNull(['a', 1, 'b', null])).toEqual(['a', 'b']);
        expect(runFilteredStringArrayOrNull(Number.NaN)).toBeNull();
    });

    it('filters runtime arrays with typed predicates', () => {
        const values = [{ id: 'a' }, { id: 1 }, null, { id: 'b' }];

        expect(
            runFilteredArray(values, (item): item is { id: string } =>
                item != null && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
            )
        ).toEqual([{ id: 'a' }, { id: 'b' }]);
        expect(runFilteredArray(null, (item): item is string => typeof item === 'string')).toEqual([]);
    });
});
