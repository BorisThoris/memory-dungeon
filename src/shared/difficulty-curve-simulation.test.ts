import { describe, expect, it } from 'vitest';

import { CURVE_BANDS, judgeDifficultyCurve, simulateDifficultyCurve } from '../../scripts/sim-difficulty-curve';
import { PAR_FLAT_RATE_PAIRS, parTurnsForFloor } from './floor-par';
import { pairsForFloor } from './pair-curve';

/**
 * The curve, as a player meets it. Nothing measured it until Gen 210 for the opening and Gen 211
 * for the rest: the cascade simulation reports bands over all floors and the censuses report
 * shares, and neither says how long a floor takes or what happens to that as the boards grow.
 */
describe('the difficulty curve', () => {
    const rows = simulateDifficultyCurve();

    it('holds every floor of the curve inside its bands', () => {
        expect(judgeDifficultyCurve(rows)).toEqual([]);
    });

    it('is the same curve on a replay', () => {
        expect(simulateDifficultyCurve({ floors: 4 })).toEqual(simulateDifficultyCurve({ floors: 4 }));
    });

    it('lets a clean player beat par on every floor, the early ones included', () => {
        /*
         * The finding this file was written for. Par is one rate times the board, and the pop is
         * what makes that rate work - but the pop's share GROWS with the board, so the rate that is
         * generous at twelve pairs was the theoretical minimum at four. Measured, a clean player
         * came in over par on floors 1, 2 and 6 and level with it on 5: the first floors anyone
         * plays were the only ones in the game where competent play failed the target.
         */
        for (const row of rows) {
            expect(row.turns, `floor ${row.floor}`).toBeLessThan(row.par);
        }
    });

    it('gives every floor a miss allowance and the big ones a rising rate', () => {
        expect(parTurnsForFloor(pairsForFloor(1))).toBe(3);
        expect(parTurnsForFloor(pairsForFloor(2))).toBe(4);
        /*
         * The rate is flat to thirteen pairs and rises after it, because that is where the pop's
         * share of the board stops keeping up (Gen 211). Par on the biggest board the game deals is
         * 19 rather than the 11 a flat rate gave, against a clean player's measured 14.6 to 15.8.
         */
        expect(PAR_FLAT_RATE_PAIRS).toBe(13);
        expect(parTurnsForFloor(13)).toBe(7);
        expect(parTurnsForFloor(14)).toBe(8);
        expect(parTurnsForFloor(24)).toBe(19);
        // Monotone: a bigger board never asks for fewer turns than a smaller one.
        for (let pairs = 2; pairs <= 24; pairs += 1) {
            expect(parTurnsForFloor(pairs), `par at ${pairs} pairs`).toBeGreaterThanOrEqual(parTurnsForFloor(pairs - 1));
        }
    });

    it('keeps the pop taking a real share of every board', () => {
        // Gen 148 shipped an opening where the pop was invisible; this is what would catch it.
        for (const row of rows) {
            expect(row.poppedPairs, `floor ${row.floor}`).toBeGreaterThanOrEqual(CURVE_BANDS.minPoppedPairs);
        }
    });

    it('would catch a floor that ran long or ended instantly', () => {
        expect(judgeDifficultyCurve([{ floor: 1, pairs: 4, suits: 2, turns: 22, par: 3, poppedPairs: 2 }])).toEqual([
            'floor 1 takes 22.0 turns, over 20',
            'floor 1 takes 22.0 turns against a par of 3'
        ]);
        expect(judgeDifficultyCurve([{ floor: 1, pairs: 4, suits: 2, turns: 1, par: 3, poppedPairs: 2 }])).toEqual([
            'floor 1 is over in 1.0 turns, under 2'
        ]);
    });
});
