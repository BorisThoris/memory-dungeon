import { describe, expect, it } from 'vitest';

import { OPENING_BANDS, judgeOpeningCurve, simulateOpeningCurve } from '../../scripts/sim-opening-curve';
import { PAR_SMALL_FLOOR_PAIRS, parTurnsForFloor } from './floor-par';
import { pairsForFloor } from './pair-curve';

/**
 * The opening, as a player meets it. Nothing measured it until Gen 210: the cascade simulation
 * reports bands over all floors and the censuses report shares, and neither says how long a floor
 * takes or what happens to that as the boards grow.
 */
describe('the opening curve', () => {
    const rows = simulateOpeningCurve();

    it('holds every floor of the opening inside its bands', () => {
        expect(judgeOpeningCurve(rows)).toEqual([]);
    });

    it('is the same curve on a replay', () => {
        expect(simulateOpeningCurve({ floors: 4 })).toEqual(simulateOpeningCurve({ floors: 4 }));
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

    it('gives the small floors their turn back and leaves the rest alone', () => {
        expect(parTurnsForFloor(pairsForFloor(1))).toBe(3);
        expect(parTurnsForFloor(pairsForFloor(2))).toBe(4);
        // Fourteen pairs is over the small-floor line, so par there is what it always was.
        expect(PAR_SMALL_FLOOR_PAIRS).toBe(13);
        expect(parTurnsForFloor(14)).toBe(7);
        expect(parTurnsForFloor(24)).toBe(11);
    });

    it('keeps the pop taking a real share of every board', () => {
        // Gen 148 shipped an opening where the pop was invisible; this is what would catch it.
        for (const row of rows) {
            expect(row.poppedPairs, `floor ${row.floor}`).toBeGreaterThanOrEqual(OPENING_BANDS.minPoppedPairs);
        }
    });

    it('would catch a floor that ran long or ended instantly', () => {
        expect(judgeOpeningCurve([{ floor: 1, pairs: 4, suits: 2, turns: 12, par: 3, poppedPairs: 2 }])).toEqual([
            'floor 1 takes 12.0 turns, over 9',
            'floor 1 takes 12.0 turns against a par of 3'
        ]);
        expect(judgeOpeningCurve([{ floor: 1, pairs: 4, suits: 2, turns: 1, par: 3, poppedPairs: 2 }])).toEqual([
            'floor 1 is over in 1.0 turns, under 2'
        ]);
    });
});
