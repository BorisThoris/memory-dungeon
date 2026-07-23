import { describe, expect, it } from 'vitest';
import { runStringArray } from './run-array-guards';

describe('run array guards', () => {
    it('passes through runtime string arrays and treats malformed values as empty', () => {
        const ids = ['a1', 'b2'];

        expect(runStringArray(ids)).toBe(ids);
        expect(runStringArray(Number.NaN)).toEqual([]);
        expect(runStringArray(null)).toEqual([]);
    });
});
