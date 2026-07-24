import { describe, expect, it } from 'vitest';
import { isRunRecord, runRecord } from './run-record-guards';

describe('run record guards', () => {
    it('passes through non-array objects and rejects malformed records', () => {
        const record = { score: 10 };

        expect(isRunRecord(record)).toBe(true);
        expect(runRecord(record)).toBe(record);
        expect(isRunRecord([])).toBe(false);
        expect(isRunRecord(null)).toBe(false);
        expect(isRunRecord(Number.NaN)).toBe(false);
        expect(runRecord([])).toEqual({});
        expect(runRecord(null)).toEqual({});
    });
});
