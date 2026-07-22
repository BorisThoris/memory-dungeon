import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { WILD_PAIR_KEY } from './tile-identity';
import { getPairProximityGridDistance } from './pairProximityHint';

const tile = (id: string, pairKey: string, state: Tile['state']): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state
});

const board2x2 = (tiles: Tile[]): BoardState => ({
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    tiles,
    flippedTileIds: tiles.filter((t) => t.state === 'flipped').map((t) => t.id),
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const boardRect = (columns: number, rows: number, tiles: Tile[]): BoardState => ({
    level: 1,
    pairCount: Math.max(1, Math.floor(tiles.length / 2)),
    columns,
    rows,
    tiles,
    flippedTileIds: tiles.filter((t) => t.state === 'flipped').map((t) => t.id),
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

describe('getPairProximityGridDistance', () => {
    it('returns Manhattan distance to the matching partner', () => {
        const b = board2x2([
            tile('a', 'p1', 'flipped'),
            tile('b', 'p1', 'hidden'),
            tile('c', 'p2', 'hidden'),
            tile('d', 'p2', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'a')).toBe(1);
    });

    it('returns diagonal distance as sum of row and column deltas', () => {
        const b = board2x2([
            tile('a', 'p1', 'flipped'),
            tile('c', 'p2', 'hidden'),
            tile('d', 'p2', 'hidden'),
            tile('b', 'p1', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'a')).toBe(2);
    });

    it('returns null for decoy tiles', () => {
        const b = board2x2([
            tile('a', '__decoy__', 'flipped'),
            tile('b', '__decoy__', 'hidden'),
            tile('c', 'p1', 'hidden'),
            tile('d', 'p1', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'a')).toBeNull();
    });

    it('uses minimum distance among wild-card legal partners', () => {
        const b = board2x2([
            tile('w', WILD_PAIR_KEY, 'flipped'),
            tile('a', 'p1', 'hidden'),
            tile('b', 'p2', 'hidden'),
            tile('c', 'p3', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'w')).toBe(1);
    });

    it('returns null when the only matching partner is not an eligible state (e.g. already matched)', () => {
        const b = board2x2([
            tile('a', 'p1', 'flipped'),
            tile('b', 'p1', 'matched'),
            tile('c', 'p2', 'hidden'),
            tile('d', 'p2', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'a')).toBeNull();
    });

    it('returns null for a hidden tile id', () => {
        const b = board2x2([
            tile('a', 'p1', 'hidden'),
            tile('b', 'p1', 'hidden'),
            tile('c', 'p2', 'hidden'),
            tile('d', 'p2', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'a')).toBeNull();
    });

    it('returns null when the tile id is absent from the board', () => {
        const b = board2x2([
            tile('a', 'p1', 'flipped'),
            tile('b', 'p1', 'hidden'),
            tile('c', 'p2', 'hidden'),
            tile('d', 'p2', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'missing')).toBeNull();
    });

    it('returns null when no tile can legally pair with the flipped tile (unique pair keys)', () => {
        const b = board2x2([
            tile('a', 'p1', 'flipped'),
            tile('b', 'p2', 'hidden'),
            tile('c', 'p3', 'hidden'),
            tile('d', 'p4', 'hidden')
        ]);
        expect(getPairProximityGridDistance(b, 'a')).toBeNull();
    });

    /** Row-major scan visits index 0 before 1; closest partner must still win (min Manhattan). */
    it('uses minimum Manhattan distance, not first matching candidate in board order', () => {
        const b = boardRect(
            3,
            2,
            [
                tile('nw', 'p1', 'hidden'),
                tile('n', 'p2', 'hidden'),
                tile('flip', 'p1', 'flipped'),
                tile('sw', 'p2', 'hidden'),
                tile('s', 'p2', 'hidden'),
                tile('se', 'p1', 'hidden')
            ]
        );
        expect(getPairProximityGridDistance(b, 'flip')).toBe(1);
    });

    it('handles a valid partner only on the last row (corner board)', () => {
        const b = boardRect(
            3,
            3,
            [
                tile('t0', 'x', 'hidden'),
                tile('t1', 'x', 'hidden'),
                tile('t2', 'x', 'hidden'),
                tile('m0', 'x', 'hidden'),
                tile('m1', 'x', 'hidden'),
                tile('m2', 'x', 'hidden'),
                tile('open', 'pk', 'flipped'),
                tile('partner', 'pk', 'hidden'),
                tile('pad', 'x', 'hidden')
            ]
        );
        expect(getPairProximityGridDistance(b, 'open')).toBe(1);
    });
});
