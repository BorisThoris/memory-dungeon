import { describe, expect, it } from 'vitest';

import { CURVE_FLOORS } from '../../scripts/sim-difficulty-curve';
import {
    PAR_MISS_ALLOWANCE,
    PAR_NARROW_PALETTE_RATE_FACTOR,
    PAR_OPENING_ALLOWANCE,
    PAR_OPENING_FLOORS,
    parOpeningAllowanceForPairs,
    parOpeningPairs,
    parPaletteRateFactor,
    parTurnsForBoard,
    parTurnsForFloor
} from './floor-par';
import { PAIRS_MAX, PAIRS_MIN, pairsForFloor } from './pair-curve';
import { SCATTERED_SUIT_CEILING, TILE_SUITS } from './tile-suit-rules';
import type { BoardState, Tile, TileSuit } from './contracts';

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
        // 2026-09-23: par at 0.72 a pair plus two opening turns, clamped at the pair count, reads
        // the pair count on every opening floor; floor 7 keeps floor 6's reading because a bigger
        // board is never cheaper.
        expect([1, 2, 3, 4, 5, 6, 7].map((floor) => parTurnsForFloor(pairsForFloor(floor)))).toEqual([
            4, 6, 7, 9, 10, 11, 11
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

    it('keeps one turn of miss allowance in par', () => {
        expect(PAR_MISS_ALLOWANCE).toBe(1);
    });
});

/**
 * Gen 259. A board dealt two suits costs a clean player 0.74 of what the same board dealt four costs
 * per pair (measured, one board re-dealt over twenty-four seeds and eight sizes), and until this
 * generation par did not know - so a third of the game's floors came in at half their allowance.
 */
const boardOf = (pairs: number, suits: number): BoardState => {
    const palette = TILE_SUITS.slice(0, suits);
    const tiles: Tile[] = [];
    for (let pair = 0; pair < pairs; pair += 1) {
        const suit = palette[pair % palette.length] as TileSuit;
        for (const half of [0, 1]) {
            tiles.push({
                id: `t-${pair}-${half}`,
                pairKey: `p-${pair}`,
                symbol: `s-${pair}`,
                state: 'hidden',
                suit
            } as Tile);
        }
    }
    return { pairCount: pairs, tiles, columns: 4, level: 1 } as BoardState;
};

describe('par and the palette', () => {
    it('charges every palette the same, since the capped pop stopped the palette changing the board', () => {
        // Re-measured the controlled way on 2026-09-23 (`PAR_NARROW_PALETTE_RATE_FACTOR`): two suits
        // and four within 0.02 turns a pair of each other at every board size.
        expect(parPaletteRateFactor(TILE_SUITS.length)).toBe(1);
        expect(parPaletteRateFactor(3)).toBe(1);
        expect(parPaletteRateFactor(SCATTERED_SUIT_CEILING)).toBe(PAR_NARROW_PALETTE_RATE_FACTOR);
        expect(parPaletteRateFactor(1)).toBe(PAR_NARROW_PALETTE_RATE_FACTOR);
        expect(PAR_NARROW_PALETTE_RATE_FACTOR).toBe(1);
    });

    it('leaves every caller that does not know the palette exactly where it was', () => {
        /*
         * The default is the full palette rather than `suitCountForPairs`, which reads a six-pair
         * board as two suits where the deal gives it three - that default would have cut floor 2's
         * par from five turns to four in silence. Nothing that passes no palette may move.
         */
        for (let pairs = PAIRS_MIN; pairs <= PAIRS_MAX; pairs += 1) {
            expect(parTurnsForFloor(pairs), `default par at ${pairs} pairs`).toBe(
                parTurnsForFloor(pairs, TILE_SUITS.length)
            );
        }
    });

    it('charges a narrow board exactly what it charges a wide one', () => {
        for (let pairs = PAIRS_MIN; pairs <= PAIRS_MAX; pairs += 1) {
            expect(parTurnsForFloor(pairs, SCATTERED_SUIT_CEILING), `par at ${pairs} pairs`).toBe(
                parTurnsForFloor(pairs, TILE_SUITS.length)
            );
        }
    });

    it('keeps par missable and monotone at a narrow palette too', () => {
        for (let floor = 1; floor <= CURVE_FLOORS; floor += 1) {
            const pairs = pairsForFloor(floor);
            for (const suits of [1, SCATTERED_SUIT_CEILING, 3, TILE_SUITS.length]) {
                expect(
                    parTurnsForFloor(pairs, suits),
                    `floor ${floor} par at ${suits} suits against ${pairs} pairs`
                ).toBeLessThanOrEqual(pairs);
                expect(parTurnsForFloor(pairs, suits)).toBeGreaterThanOrEqual(1);
            }
        }
        for (const suits of [SCATTERED_SUIT_CEILING, TILE_SUITS.length]) {
            for (let pairs = PAIRS_MIN + 1; pairs <= PAIRS_MAX; pairs += 1) {
                expect(
                    parTurnsForFloor(pairs, suits),
                    `par at ${pairs} pairs, ${suits} suits`
                ).toBeGreaterThanOrEqual(parTurnsForFloor(pairs - 1, suits));
            }
        }
    });

    it('reads the palette off the board, so a scattered floor gets its own par', () => {
        const narrow = boardOf(20, SCATTERED_SUIT_CEILING);
        const wide = boardOf(20, TILE_SUITS.length);
        expect(parTurnsForBoard(narrow)).toBe(parTurnsForFloor(20, SCATTERED_SUIT_CEILING));
        expect(parTurnsForBoard(wide)).toBe(parTurnsForFloor(20, TILE_SUITS.length));
        expect(parTurnsForBoard(narrow)).toBe(parTurnsForBoard(wide));
        // No board is the full palette's board, so nothing reads a missing one as a free floor.
        expect(parTurnsForBoard(null)).toBe(parTurnsForFloor(0));
    });
});
