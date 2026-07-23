import { describe, expect, it } from 'vitest';

import { type BoardState, type Tile } from './contracts';
import { selectGambitMatchedPair } from './gambit-match-rules';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'flipped'
});

const board = (tiles: Tile[], flippedTileIds: string[]): Pick<BoardState, 'tiles' | 'flippedTileIds'> => ({
    tiles,
    flippedTileIds
});

describe('gambit match rules', () => {
    it('selects the first two flipped tiles when they match', () => {
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'A'),
            tile('c', 'C')
        ], ['a', 'b', 'c']))).toEqual({
            firstTileId: 'a',
            secondTileId: 'b',
            thirdTileId: 'c'
        });
    });

    it('selects first and third flipped tiles when they match', () => {
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'B'),
            tile('c', 'A')
        ], ['a', 'b', 'c']))).toEqual({
            firstTileId: 'a',
            secondTileId: 'c',
            thirdTileId: 'b'
        });
    });

    it('selects second and third flipped tiles when they match', () => {
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'B'),
            tile('c', 'B')
        ], ['a', 'b', 'c']))).toEqual({
            firstTileId: 'b',
            secondTileId: 'c',
            thirdTileId: 'a'
        });
    });

    it('returns null unless exactly one gambit pair can be selected', () => {
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'B'),
            tile('c', 'C')
        ], ['a', 'b', 'c']))).toBeNull();
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'A')
        ], ['a', 'b']))).toBeNull();
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'A')
        ], ['a', 'b', 'missing']))).toBeNull();
        expect(selectGambitMatchedPair(board([
            tile('a', 'A'),
            tile('b', 'A'),
            tile('c', 'C')
        ], Number.NaN as unknown as string[]))).toBeNull();
    });
});
