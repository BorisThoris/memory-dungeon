import { describe, expect, it, vi } from 'vitest';
import {
    createMulberry32,
    deriveDailyMutatorIndex,
    deriveDailyRunSeed,
    deriveLevelTileRngSeed,
    hashStringToSeed,
    shuffleWithRng,
    utcDateKeyMinusOneDay
} from './rng';

describe('hashStringToSeed', () => {
    it('is deterministic for the same input', () => {
        expect(hashStringToSeed('hello')).toBe(hashStringToSeed('hello'));
    });

    it('differs for different strings', () => {
        expect(hashStringToSeed('a')).not.toBe(hashStringToSeed('b'));
    });
});

describe('createMulberry32', () => {
    it('produces a deterministic [0,1) sequence for a fixed seed', () => {
        const a = createMulberry32(12345);
        const b = createMulberry32(12345);
        expect(a()).toBe(b());
        expect(a()).toBe(b());
        expect(a()).toBe(b());
    });

    it('produces independent streams for different seeds', () => {
        const x = createMulberry32(1);
        const y = createMulberry32(2);
        const seq = (r: () => number) => [r(), r(), r(), r(), r()];
        expect(seq(x)).not.toEqual(seq(y));
    });

    it('does not share state between factory instances (partial consumption)', () => {
        const a = createMulberry32(99);
        const b = createMulberry32(99);
        a();
        a();
        expect(b()).toBe(createMulberry32(99)());
    });
});

describe('shuffleWithRng', () => {
    it('returns a permutation of the input', () => {
        const rng = createMulberry32(99);
        const input = [1, 2, 3, 4, 5];
        const out = shuffleWithRng(rng, input);
        expect(out).toHaveLength(input.length);
        expect([...out].sort((a, b) => a - b)).toEqual([...input].sort((a, b) => a - b));
    });

    it('does not use Math.random (no accidental global RNG)', () => {
        const spy = vi.spyOn(Math, 'random').mockReturnValue(0.111);
        const rng = createMulberry32(42);
        shuffleWithRng(rng, ['a', 'b', 'c', 'd']);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('normalizes malformed rng rolls while preserving a permutation', () => {
        const input = ['a', 'b', 'c'];

        expect(shuffleWithRng(() => Number.NaN, input)).toEqual(['b', 'c', 'a']);
        expect(shuffleWithRng(() => Number.POSITIVE_INFINITY, input)).toEqual(['b', 'c', 'a']);
        expect(shuffleWithRng(() => 1, input)).toEqual(['a', 'b', 'c']);
        expect(input).toEqual(['a', 'b', 'c']);
    });
});

describe('derived seeds', () => {
    it('deriveLevelTileRngSeed is stable for the same inputs', () => {
        expect(deriveLevelTileRngSeed(10, 3, 8)).toBe(deriveLevelTileRngSeed(10, 3, 8));
    });

    it('deriveDailyRunSeed is stable for a fixed date', () => {
        const d = new Date(Date.UTC(2026, 3, 17, 12, 0, 0));
        expect(deriveDailyRunSeed(8, d)).toBe(deriveDailyRunSeed(8, d));
    });

    it('deriveDailyMutatorIndex is bounded', () => {
        expect(deriveDailyMutatorIndex(123456, 8)).toBeGreaterThanOrEqual(0);
        expect(deriveDailyMutatorIndex(123456, 8)).toBeLessThan(8);
    });

    it('subtracts one UTC day only for valid compact daily keys', () => {
        expect(utcDateKeyMinusOneDay('20260301')).toBe('20260228');
        expect(utcDateKeyMinusOneDay('20260231')).toBe('20260231');
        expect(utcDateKeyMinusOneDay('2026-03-01')).toBe('2026-03-01');
    });
});
