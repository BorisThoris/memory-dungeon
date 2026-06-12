import { describe, expect, it } from 'vitest';
import type { BoardState, RunStatus, Tile } from '../../shared/contracts';
import { getTileBoardPairProximityDistance } from './tileBoardPairProximityState';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile =>
    ({
        id,
        pairKey,
        label: id,
        state
    }) as Tile;

const board = (tiles: Tile[]): BoardState =>
    ({
        level: 1,
        pairCount: Math.floor(tiles.length / 2),
        columns: 2,
        rows: Math.ceil(tiles.length / 2),
        tiles,
        flippedTileIds: tiles.filter((candidate) => candidate.state === 'flipped').map((candidate) => candidate.id),
        matchedPairs: 0,
        floorArchetypeId: null
    }) as BoardState;

const proximityDistance = (
    overrides: Partial<Parameters<typeof getTileBoardPairProximityDistance>[0]> = {}
) => {
    const b = board([
        tile('a1', 'pair-a', 'flipped'),
        tile('b1', 'pair-b', 'hidden'),
        tile('a2', 'pair-a', 'hidden'),
        tile('b2', 'pair-b', 'hidden')
    ]);

    return getTileBoardPairProximityDistance({
        board: b,
        pairProximityHintsEnabled: true,
        runStatus: 'playing' as RunStatus,
        tile: b.tiles[0]!,
        ...overrides
    });
};

describe('tileBoardPairProximityState', () => {
    it('returns the grid distance for flipped tiles while playing or resolving', () => {
        expect(proximityDistance()).toBe(1);
        expect(proximityDistance({ runStatus: 'resolving' })).toBe(1);
    });

    it('stays off when hints are disabled', () => {
        expect(proximityDistance({ pairProximityHintsEnabled: false })).toBeNull();
    });

    it('stays off outside playing and resolving states', () => {
        expect(proximityDistance({ runStatus: 'paused' })).toBeNull();
        expect(proximityDistance({ runStatus: 'gameOver' })).toBeNull();
    });

    it('stays off for non-flipped tiles', () => {
        expect(proximityDistance({ tile: tile('a1', 'pair-a', 'hidden') })).toBeNull();
        expect(proximityDistance({ tile: tile('a1', 'pair-a', 'matched') })).toBeNull();
    });
});
