import { describe, expect, it } from 'vitest';

import { AUTHORED_FLOOR_PAIRS, PAIRS_BASE, PAIRS_GROWTH, PAIRS_MAX, PAIRS_MIN, pairsForFloor } from './pair-curve';
import { authoredFloorLayout } from './authored-floors';

describe('the pair curve', () => {
    it('deals the floors the thesis tabulates (§32.2), exactly', () => {
        const table: Array<[floor: number, pairs: number]> = [
            [1, 4],
            [2, 6],
            [3, 7],
            [4, 9],
            [5, 10],
            [6, 11],
            [8, 12],
            [10, 13],
            [12, 14],
            [15, 15],
            [20, 17],
            [30, 19],
            [50, 23],
            [60, 24]
        ];
        for (const [floor, pairs] of table) {
            expect(pairsForFloor(floor), `floor ${floor}`).toBe(pairs);
        }
        expect(PAIRS_BASE).toBe(7);
        expect(PAIRS_GROWTH).toBe(2.4);
        expect(PAIRS_MAX).toBe(24);
    });

    it('agrees with the authored floors, which are dealt by their layouts and not by this curve', () => {
        // A layout the deal cannot fill is silently abandoned for the ordinary deal, so a curve
        // that stops matching the authored sizes would turn the three teaching floors off with
        // nothing failing. This is the check that keeps that from happening quietly.
        AUTHORED_FLOOR_PAIRS.forEach((pairs, index) => {
            const level = index + 1;
            expect(authoredFloorLayout(level)?.pairs, `floor ${level}`).toBe(pairs);
            expect(pairsForFloor(level), `floor ${level}`).toBe(pairs);
        });
        expect(authoredFloorLayout(AUTHORED_FLOOR_PAIRS.length + 1)).toBeNull();
    });

    it('never falls below two pairs or climbs past the cap, whatever the floor', () => {
        expect(pairsForFloor(0)).toBe(AUTHORED_FLOOR_PAIRS[0]);
        expect(pairsForFloor(-4)).toBe(AUTHORED_FLOOR_PAIRS[0]);
        expect(pairsForFloor(Number.NaN)).toBe(AUTHORED_FLOOR_PAIRS[0]);
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
