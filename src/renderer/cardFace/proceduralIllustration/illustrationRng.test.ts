import { describe, expect, it } from 'vitest';
import { createIllustrationRng } from './illustrationRng';

describe('createIllustrationRng', () => {
    it('is deterministic for the same seed', () => {
        const a = createIllustrationRng(42_424_242);
        const b = createIllustrationRng(42_424_242);
        for (let i = 0; i < 20; i++) {
            expect(a.nextU32()).toBe(b.nextU32());
            expect(a.nextFloat01()).toBe(b.nextFloat01());
        }
    });

    it('pickWeighted respects weights', () => {
        const rng = createIllustrationRng(9001);
        const picks = { x: 0, y: 0 };
        for (let i = 0; i < 200; i++) {
            const r = rng.pickWeighted([
                { value: 'x' as const, weight: 3 },
                { value: 'y' as const, weight: 1 }
            ]);
            picks[r] += 1;
        }
        expect(picks.x).toBeGreaterThan(picks.y);
    });

    it('normalizes malformed integer bounds', () => {
        const rng = createIllustrationRng(12);

        expect(rng.nextInt(Number.NaN)).toBe(0);
        expect(rng.nextInt(Number.POSITIVE_INFINITY)).toBe(0);
        expect(rng.nextInt(-2)).toBe(0);
        expect(rng.nextIntInclusive(Number.NaN, 4)).toBe(0);
        expect(rng.nextIntInclusive(3.8, Number.POSITIVE_INFINITY)).toBe(3);
        expect(rng.nextIntInclusive(7.8, 2.2)).toBe(7);
    });

    it('normalizes malformed weighted pools', () => {
        const rng = createIllustrationRng(120);

        expect(rng.pickWeighted([{ value: 'fallback', weight: Number.NaN }])).toBe('fallback');
        expect(
            rng.pickWeighted([
                { value: 'bad', weight: Number.POSITIVE_INFINITY },
                { value: 'good', weight: 1 }
            ])
        ).toBe('good');
        expect(() => rng.pickWeighted([])).toThrow(/at least one entry/);
    });
});
