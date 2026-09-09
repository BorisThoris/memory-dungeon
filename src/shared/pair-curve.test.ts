import { describe, expect, it } from 'vitest';

import { PAIRS_BASE, PAIRS_GROWTH, PAIRS_MAX, PAIRS_MIN, pairsForFloor } from './pair-curve';

describe('the pair curve', () => {
    it('deals the floors the thesis tabulates (§32.2), exactly', () => {
        const table: Array<[floor: number, pairs: number]> = [
            [1, 3],
            [2, 6],
            [3, 7],
            [4, 8],
            [5, 8],
            [6, 9],
            [8, 10],
            [10, 11],
            [12, 12],
            [15, 13],
            [20, 14],
            [30, 17],
            [50, 21]
        ];
        for (const [floor, pairs] of table) {
            expect(pairsForFloor(floor), `floor ${floor}`).toBe(pairs);
        }
        expect(PAIRS_BASE).toBe(3);
        expect(PAIRS_GROWTH).toBe(2.6);
        expect(PAIRS_MAX).toBe(24);
    });

    it('never falls below two pairs or climbs past the cap, whatever the floor', () => {
        expect(pairsForFloor(0)).toBe(PAIRS_BASE);
        expect(pairsForFloor(-4)).toBe(PAIRS_BASE);
        expect(pairsForFloor(Number.NaN)).toBe(PAIRS_BASE);
        expect(pairsForFloor(1.9)).toBe(pairsForFloor(1));
        expect(pairsForFloor(200)).toBe(PAIRS_MAX);
        expect(pairsForFloor(Number.POSITIVE_INFINITY)).toBe(PAIRS_MAX);
        for (let floor = 1; floor <= 400; floor += 1) {
            const pairs = pairsForFloor(floor);
            expect(pairs).toBeGreaterThanOrEqual(PAIRS_MIN);
            expect(pairs).toBeLessThanOrEqual(PAIRS_MAX);
            expect(pairs).toBeGreaterThanOrEqual(pairsForFloor(floor - 1));
        }
    });
});
