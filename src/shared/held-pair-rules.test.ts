import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { BoardState, RunState, Tile } from './contracts';
import { describeHeldPair, getHeldPairSpan, getHeldPairTileIds, HELD_PAIR_PIN_COUNT } from './held-pair-rules';

/**
 * The decision at thesis §30.3(c) / T3.4, and the two constraints it comes with. What is worth
 * testing here is not that a distance is computed - it is that the claim cannot become a free match
 * test, and that it is exactly two pins and not one or three.
 */
describe('the held pair', () => {
    const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile =>
        ({ id, label: pairKey, pairKey, state, symbol: pairKey }) as Tile;

    const run = (pinnedTileIds: string[], tiles: Tile[], columns = 4): Pick<RunState, 'board' | 'pinnedTileIds'> => ({
        board: { columns, rows: Math.ceil(tiles.length / columns), tiles } as BoardState,
        pinnedTileIds
    });

    const grid = (pairKeys: string[]): Tile[] => pairKeys.map((key, index) => tile(`t${index}`, key));

    it('never validates: the same two positions read the same whether they match or not', () => {
        /*
         * The constraint the whole design turns on. If marking two tiles told the player they match,
         * it would be a match test with no turn spent and no mismatch - strictly better than
         * flipping, and the end of the game. So the same two positions are given a matching identity
         * and a mismatched one, and everything this module says about them has to be identical.
         */
        const matching = run(['t0', 't6'], grid(['a', 'b', 'c', 'd', 'e', 'f', 'a', 'h']));
        const mismatched = run(['t0', 't6'], grid(['a', 'b', 'c', 'd', 'e', 'f', 'z', 'h']));
        expect(getHeldPairTileIds(matching)).toEqual(getHeldPairTileIds(mismatched));
        expect(getHeldPairSpan(matching)).toEqual(getHeldPairSpan(mismatched));
        expect(describeHeldPair(matching, 3)).toEqual(describeHeldPair(mismatched, 3));
        // And the source carries no way to look: no identity field is read anywhere in it.
        const source = readFileSync(resolve(process.cwd(), 'src/shared/held-pair-rules.ts'), 'utf8');
        for (const identity of ['pairKey', 'symbol', 'tilesArePairMatch', 'label']) {
            expect(source.split('*/').pop() ?? source, `held-pair-rules reads ${identity}`).not.toContain(identity);
        }
    });

    it('is exactly two pins: one is a note, three is a notebook', () => {
        const tiles = grid(['a', 'b', 'c', 'd', 'e', 'f', 'a', 'h']);
        expect(HELD_PAIR_PIN_COUNT).toBe(2);
        expect(getHeldPairTileIds(run([], tiles))).toBeNull();
        expect(getHeldPairTileIds(run(['t0'], tiles))).toBeNull();
        expect(getHeldPairTileIds(run(['t0', 't6'], tiles))).toEqual(['t0', 't6']);
        // A third pin lets the claim go, which is what makes it a commitment rather than a notebook.
        expect(getHeldPairTileIds(run(['t0', 't6', 't3'], tiles))).toBeNull();
        expect(getHeldPairSpan(run(['t0', 't6', 't3'], tiles))).toBeNull();
    });

    it('drops the claim when a tile stops being hidden, rather than pointing at a gap', () => {
        const flipped = grid(['a', 'b', 'c', 'd', 'e', 'f', 'a', 'h']);
        flipped[6] = tile('t6', 'a', 'matched');
        expect(getHeldPairTileIds(run(['t0', 't6'], flipped))).toBeNull();
        const removed = grid(['a', 'b', 'c', 'd', 'e', 'f', 'a', 'h']);
        removed[0] = tile('t0', 'a', 'removed');
        expect(getHeldPairSpan(run(['t0', 't6'], removed))).toBeNull();
    });

    it('measures the span in the steps a break would walk, not in a straight line', () => {
        const tiles = grid(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
        // t0 is row 0 col 0; t6 is row 1 col 2. Two across and one down is three steps, not 2.24.
        expect(getHeldPairSpan(run(['t0', 't6'], tiles))).toBe(3);
        // Neighbours are one step, and the copy says step rather than steps.
        expect(getHeldPairSpan(run(['t0', 't1'], tiles))).toBe(1);
        expect(describeHeldPair(run(['t0', 't1'], tiles), 3)).toContain('1 step apart');
        expect(describeHeldPair(run(['t0', 't6'], tiles), 3)).toContain('3 steps apart');
        // With no claim the dock says what the pin does, not what it is holding.
        expect(describeHeldPair(run(['t0'], tiles), 3)).toBe('Pin up to 3 tiles');
    });

    it('says nothing at all when there is no board', () => {
        expect(getHeldPairTileIds({ board: null, pinnedTileIds: ['t0', 't1'] })).toBeNull();
        expect(getHeldPairSpan({ board: null, pinnedTileIds: ['t0', 't1'] })).toBeNull();
        // A pin naming a tile the board does not have is not half a claim.
        const tiles = grid(['a', 'b', 'c', 'd']);
        expect(getHeldPairTileIds(run(['t0', 'gone'], tiles))).toBeNull();
    });
});
