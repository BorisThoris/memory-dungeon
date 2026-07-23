import { describe, expect, it } from 'vitest';
import type { BoardState } from './contracts';
import { getSafeBoardColumns, getSafeBoardRows } from './board-grid-dimensions';

const board = (columns: number, rows: number, tileCount: number): BoardState => ({
    level: 1,
    pairCount: Math.max(1, Math.floor(tileCount / 2)),
    columns,
    rows,
    tiles: Array.from({ length: tileCount }, (_, index) => ({
        id: `tile-${index}`,
        pairKey: `pair-${index}`,
        state: 'hidden',
        symbol: String(index),
        label: String(index)
    })),
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

describe('board grid dimensions', () => {
    it('normalizes columns to a positive integer', () => {
        expect(getSafeBoardColumns(board(3.9, 2, 6))).toBe(3);
        expect(getSafeBoardColumns(board(0, 2, 6))).toBe(1);
        expect(getSafeBoardColumns(board(Number.NaN, 2, 6))).toBe(1);
    });

    it('normalizes rows with a tile-count fallback', () => {
        const columns = getSafeBoardColumns(board(2, Number.NaN, 5));

        expect(getSafeBoardRows(board(2, 3.9, 5), 2)).toBe(3);
        expect(getSafeBoardRows(board(2, 0, 5), 2)).toBe(1);
        expect(getSafeBoardRows(board(2, Number.NaN, 5), columns)).toBe(3);
    });
});
