import { describe, expect, it } from 'vitest';
import { type BoardState, type RunState } from './contracts';
import { createNewRun } from './game';
import {
    getMatchFloaterAnchorTileIds,
    getMismatchFloaterAnchorTileIds
} from './tile-floater-anchor-rules';

const runWithFlippedTiles = (flippedTileIds: string[]): RunState => {
    const run = createNewRun(0, { runSeed: 3 });
    const board = run.board!;
    const tiles = [
        { ...board.tiles[0], id: 'a', pairKey: 'pair-a' },
        { ...board.tiles[1], id: 'b', pairKey: 'pair-b' },
        { ...board.tiles[2], id: 'c', pairKey: 'pair-a' }
    ];

    return {
        ...run,
        board: {
            ...board,
            tiles,
            flippedTileIds
        } satisfies BoardState
    };
};

describe('tile floater anchor rules', () => {
    it('anchors match and mismatch floaters to two flipped tile ids', () => {
        const run = runWithFlippedTiles(['a', 'b']);

        expect(getMatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'a', tileIdB: 'b' });
        expect(getMismatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'a', tileIdB: 'b' });
    });

    it('anchors gambit match floaters to the matching pair', () => {
        const run = runWithFlippedTiles(['a', 'b', 'c']);

        expect(getMatchFloaterAnchorTileIds(run)).toEqual({ tileIdA: 'a', tileIdB: 'c' });
    });

    it('anchors gambit mismatch floaters to the whole flip sequence', () => {
        const run = runWithFlippedTiles(['a', 'b', 'c']);

        expect(getMismatchFloaterAnchorTileIds(run)).toEqual({
            tileIdA: 'a',
            tileIdB: 'b',
            tileIdC: 'c'
        });
    });

    it('returns null when no board or no gambit pair is available', () => {
        const run = {
            ...runWithFlippedTiles(['a', 'b', 'c']),
            board: {
                ...runWithFlippedTiles(['a', 'b', 'c']).board!,
                tiles: [
                    { ...runWithFlippedTiles(['a', 'b', 'c']).board!.tiles[0], pairKey: 'one' },
                    { ...runWithFlippedTiles(['a', 'b', 'c']).board!.tiles[1], pairKey: 'two' },
                    { ...runWithFlippedTiles(['a', 'b', 'c']).board!.tiles[2], pairKey: 'three' }
                ]
            }
        };

        expect(getMatchFloaterAnchorTileIds(null)).toBeNull();
        expect(getMismatchFloaterAnchorTileIds(null)).toBeNull();
        expect(getMatchFloaterAnchorTileIds(run)).toBeNull();
    });
});
