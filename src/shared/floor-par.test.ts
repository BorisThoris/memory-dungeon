import { describe, expect, it } from 'vitest';

import { CURVE_FLOORS } from '../../scripts/sim-difficulty-curve';
import {
    PAR_MISS_ALLOWANCE,
    PAR_OPENING_ALLOWANCE,
    PAR_OPENING_FLOORS,
    parOpeningAllowanceForPairs,
    parOpeningPairs,
    parTurnsForFloor,
    TURN_CEILING_PAR_MULTIPLIER,
    turnCeilingForFloor
} from './floor-par';
import { PAIRS_MAX, PAIRS_MIN, pairsForFloor } from './pair-curve';

/**
 * Par had no test of its own until Gen 220, which is odd for the number every floor is measured
 * against - the assertions that existed lived in the curve simulation's suite and were about the
 * curve. These are about the rule.
 */
describe('the floor par', () => {
    it('gives the first six floors a turn and the seventh none', () => {
        /*
         * `docs/RESEARCH_NOTES_2.md`, PopCap's Jason Kapalka on Peggle: extra luck across the first
         * half-dozen levels, while the player is learning. Measured against par this game did the
         * opposite - floors 1-6 spent a mean 0.797 of their allowance against 0.640 deeper in.
         */
        expect([1, 2, 3, 4, 5, 6, 7].map((floor) => parTurnsForFloor(pairsForFloor(floor)))).toEqual([
            4, 5, 6, 7, 7, 7, 7
        ]);
        expect(parOpeningAllowanceForPairs(pairsForFloor(PAR_OPENING_FLOORS))).toBe(PAR_OPENING_ALLOWANCE);
        expect(parOpeningAllowanceForPairs(pairsForFloor(PAR_OPENING_FLOORS + 1))).toBe(0);
    });

    it('reads its own boundary off the pair curve, and the curve keeps that boundary a step', () => {
        /*
         * The allowance is given by board size because par is, and the two agree today only because
         * floor 6 deals eleven pairs and floor 7 deals twelve. A pair curve that closed that step
         * would hand the assist to floor 7 in silence, so the step is asserted rather than assumed.
         */
        expect(parOpeningPairs()).toBe(pairsForFloor(PAR_OPENING_FLOORS));
        expect(pairsForFloor(PAR_OPENING_FLOORS)).toBeLessThan(pairsForFloor(PAR_OPENING_FLOORS + 1));
    });

    it('leaves par missable by a memory that gets no help from the pop', () => {
        /*
         * The bound that decides how far the tilt can go. A board of n pairs takes at least n turns
         * to clear if nothing ever pops, so a par above the pair count is a target a player who
         * never forgets cannot miss even with the cascade switched off - at which point par has
         * stopped measuring anything. Floor 1 sits exactly on the line at four turns for four pairs.
         */
        for (let floor = 1; floor <= CURVE_FLOORS; floor += 1) {
            const pairs = pairsForFloor(floor);
            expect(parTurnsForFloor(pairs), `floor ${floor} par against ${pairs} pairs`).toBeLessThanOrEqual(pairs);
        }
        // And the bar bites: a second opening turn would breach it on the floor that sits on the line.
        expect(parTurnsForFloor(pairsForFloor(1)) + 1).toBeGreaterThan(pairsForFloor(1));
    });

    it('never asks a bigger board for fewer turns, the allowance boundary included', () => {
        for (let pairs = PAIRS_MIN + 1; pairs <= PAIRS_MAX; pairs += 1) {
            expect(parTurnsForFloor(pairs), `par at ${pairs} pairs`).toBeGreaterThanOrEqual(parTurnsForFloor(pairs - 1));
        }
        // The step the allowance could have inverted: eleven pairs carries it, twelve does not.
        expect(parTurnsForFloor(parOpeningPairs() + 1)).toBeGreaterThanOrEqual(parTurnsForFloor(parOpeningPairs()));
    });

    it('carries the allowance into the turn ceiling, because the ceiling is par', () => {
        expect(PAR_MISS_ALLOWANCE).toBe(1);
        for (const floor of [1, 6, 7, 52]) {
            const pairs = pairsForFloor(floor);
            expect(turnCeilingForFloor(pairs)).toBe(parTurnsForFloor(pairs) * TURN_CEILING_PAR_MULTIPLIER);
        }
    });
});
