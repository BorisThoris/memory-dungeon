import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RunState,
    Tile
} from './contracts';
import {
    canDestroyPair,
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard,
    canSwapHiddenTiles
} from './board-power-availability';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state
});

const board = (tiles: Tile[], columns = 4): BoardState => ({
    level: 1,
    pairCount: 0,
    columns,
    rows: Math.ceil(tiles.length / columns),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    board: board([
        tile('a1', 'A'),
        tile('a2', 'A'),
        tile('b1', 'B'),
        tile('b2', 'B')
    ]),
    shuffleCharges: 1,
    regionShuffleCharges: 1,
    destroyPairCharges: 1,
    ...overrides
} as RunState);

describe('board power availability rules', () => {
    it('requires playing state, clear flips, a shuffle charge, and enough hidden pairs for shuffle', () => {
        expect(canShuffleBoard(run())).toBe(true);
        expect(canShuffleBoard(run({ status: 'memorize' }))).toBe(false);
        expect(canShuffleBoard(run({ board: { ...run().board!, flippedTileIds: ['a1'] } }))).toBe(false);
        expect(canShuffleBoard(run({ shuffleCharges: 0 }))).toBe(false);
        expect(canShuffleBoard(run({ activeContract: { noShuffle: true } as RunState['activeContract'] }))).toBe(false);
    });

    it('fails closed when board power open-flip state is malformed', () => {
        const malformed = run({
            board: { ...run().board!, flippedTileIds: Number.NaN as unknown as string[] }
        });

        expect(canShuffleBoard(malformed)).toBe(false);
        expect(canDestroyPair(malformed, 'a1')).toBe(false);
        expect(canRegionShuffle(malformed)).toBe(false);
        expect(canRegionShuffleRow(malformed, 0)).toBe(false);
        expect(canSwapHiddenTiles(malformed, 'a1', 'b1')).toBe(false);
    });

    it('fails closed for playing runs without a board', () => {
        const boardless = run({ board: null });

        expect(canShuffleBoard(boardless)).toBe(false);
        expect(canDestroyPair(boardless, 'a1')).toBe(false);
        expect(canRegionShuffle(boardless)).toBe(false);
        expect(canRegionShuffleRow(boardless, 0)).toBe(false);
        expect(canSwapHiddenTiles(boardless, 'a1', 'b1')).toBe(false);
    });



    it('allows region shuffle when any hidden pair exists, then gates each row by hidden tile count', () => {
        const state = run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B', 'matched')
            ], 2)
        });

        expect(canRegionShuffle(state)).toBe(true);
        expect(canRegionShuffleRow(state, 0)).toBe(true);
        expect(canRegionShuffleRow(state, 1)).toBe(false);
        expect(canRegionShuffle(run({ regionShuffleCharges: 0 }))).toBe(false);
    });

    it('allows tile swap only for two hidden tiles with row/swap payment and no open flip', () => {
        expect(canSwapHiddenTiles(run(), 'a1', 'b1')).toBe(true);
        expect(canSwapHiddenTiles(run({ status: 'memorize' }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({ board: { ...run().board!, flippedTileIds: ['a1'] } }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({ activeContract: { noShuffle: true } as RunState['activeContract'] }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run({ regionShuffleCharges: 0 }), 'a1', 'b1')).toBe(false);
        expect(canSwapHiddenTiles(run(), 'a1', 'a1')).toBe(false);
        expect(canSwapHiddenTiles(run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A', 'matched'),
                tile('b1', 'B'),
                tile('b2', 'B')
            ])
        }), 'a1', 'a2')).toBe(false);
    });
});
