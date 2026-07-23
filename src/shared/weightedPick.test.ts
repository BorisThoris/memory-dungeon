import { describe, expect, it } from 'vitest';
import { pickWeightedIndex, pickWeightedWithoutReplacement } from './weightedPick';

const makeRng = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let x = s;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
};

describe('weightedPick', () => {
    it('pickWeightedIndex respects weights', () => {
        const rng = makeRng(42);
        const counts = [0, 0, 0];
        for (let i = 0; i < 3000; i += 1) {
            counts[pickWeightedIndex(rng, [10, 80, 10])] += 1;
        }
        expect(counts[1]).toBeGreaterThan(counts[0]);
        expect(counts[1]).toBeGreaterThan(counts[2]);
    });

    it('pickWeightedIndex ignores malformed weights and rng rolls', () => {
        expect(pickWeightedIndex(() => Number.NaN, [Number.NaN, 4, Number.POSITIVE_INFINITY])).toBe(1);
        expect(pickWeightedIndex(() => 0.5, [Number.NaN, 4, Number.POSITIVE_INFINITY])).toBe(1);
        expect(pickWeightedIndex(() => 0.5, [-10, 4, -2])).toBe(1);
        expect(pickWeightedIndex(() => Number.POSITIVE_INFINITY, [0, 0, 0])).toBe(0);
    });

    it('pickWeightedWithoutReplacement is deterministic', () => {
        const rng = makeRng(99);
        const a = pickWeightedWithoutReplacement(
            rng,
            [
                { value: 'a', weight: 1 },
                { value: 'b', weight: 2 },
                { value: 'c', weight: 3 }
            ],
            2
        );
        const rng2 = makeRng(99);
        const b = pickWeightedWithoutReplacement(
            rng2,
            [
                { value: 'a', weight: 1 },
                { value: 'b', weight: 2 },
                { value: 'c', weight: 3 }
            ],
            2
        );
        expect(a).toEqual(b);
    });

    it('pickWeightedWithoutReplacement returns unique values', () => {
        const rng = makeRng(1);
        const out = pickWeightedWithoutReplacement(
            rng,
            [
                { value: 'x', weight: 1 },
                { value: 'y', weight: 1 },
                { value: 'z', weight: 1 }
            ],
            3
        );
        expect(new Set(out).size).toBe(3);
    });

    it('pickWeightedWithoutReplacement normalizes malformed weights and counts', () => {
        expect(
            pickWeightedWithoutReplacement(
                () => 0.75,
                [
                    { value: 'a', weight: Number.NaN },
                    { value: 'b', weight: 1 },
                    { value: 'c', weight: Number.POSITIVE_INFINITY }
                ],
                Number.POSITIVE_INFINITY
            )
        ).toEqual(['b', 'c', 'a']);
        expect(
            pickWeightedWithoutReplacement(
                () => 0.75,
                [
                    { value: 'a', weight: -1 },
                    { value: 'b', weight: 1 },
                    { value: 'c', weight: Number.NaN }
                ],
                1.9
            )
        ).toEqual(['b']);
        expect(
            pickWeightedWithoutReplacement(
                () => 0.75,
                [
                    { value: 'a', weight: 1 },
                    { value: 'b', weight: 1 }
                ],
                9
            )
        ).toEqual(['b', 'a']);
        expect(
            pickWeightedWithoutReplacement(
                () => 0.75,
                [
                    { value: 'a', weight: 1 },
                    { value: 'b', weight: 1 }
                ],
                Number.NaN
            )
        ).toEqual(['b', 'a']);
        expect(
            pickWeightedWithoutReplacement(
                () => 0.75,
                [
                    { value: 'a', weight: 1 },
                    { value: 'b', weight: 1 }
                ],
                -1
            )
        ).toEqual([]);
    });
});
