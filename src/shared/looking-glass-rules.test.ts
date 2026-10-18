import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    LOOKING_GLASS_EVERY_MATCHES,
    lookingGlassAxis,
    lookingGlassMatchesUntilTurn,
    lookingGlassSwaps,
    lookingGlassTurnsOnMatch
} from './looking-glass-rules';
import { applyRestlessDrift } from './restless-floor-rules';

const grid = (columns: number, rows: number, count = columns * rows): Pick<BoardState, 'columns' | 'rows' | 'tiles'> => ({
    columns,
    rows,
    tiles: Array.from({ length: count }, (_, index) => ({ id: `t${index}`, pairKey: `p${index >> 1}`, symbol: '', label: '', state: 'hidden' }) as Tile)
});
const ids = (board: Pick<BoardState, 'tiles'>): string[] => board.tiles.map((tile) => tile.id);
const mirror = (board: Pick<BoardState, 'columns' | 'rows' | 'tiles'>, pinned: string[] = [], stay: string[] = []) =>
    applyRestlessDrift(board as BoardState, lookingGlassSwaps(board, pinned, stay));

describe('the looking glass', () => {
    it('turns on every third match of the floor', () => {
        const turns = Array.from({ length: 9 }, (_, i) => lookingGlassTurnsOnMatch(i + 1));
        expect(turns).toEqual([false, false, true, false, false, true, false, false, true]);
        expect(lookingGlassTurnsOnMatch(0)).toBe(false);
        // The HUD's clock counts down to it, the turning match included.
        expect([0, 1, 2, 3, 4].map(lookingGlassMatchesUntilTurn)).toEqual([3, 2, 1, 3, 2]);
        expect(LOOKING_GLASS_EVERY_MATCHES).toBe(3);
    });

    it('mirrors a wide board left to right, every row reflected', () => {
        const board = grid(4, 2);
        expect(lookingGlassAxis(board)).toBe('left_right');
        expect(ids(mirror(board))).toEqual(['t3', 't2', 't1', 't0', 't7', 't6', 't5', 't4']);
    });

    it('mirrors a tall board top to bottom, so a phone never just swaps two columns', () => {
        const board = grid(2, 4);
        expect(lookingGlassAxis(board)).toBe('top_bottom');
        expect(ids(mirror(board))).toEqual(['t6', 't7', 't4', 't5', 't2', 't3', 't0', 't1']);
    });

    it('mirrors a short last row within the cells it has', () => {
        const board = grid(4, 2, 7);
        expect(ids(mirror(board))).toEqual(['t3', 't2', 't1', 't0', 't6', 't5', 't4']);
    });

    it('leaves pinned cards and the pair just matched where they are, with their reflections', () => {
        const board = grid(4, 2);
        expect(ids(mirror(board, ['t0']))).toEqual(['t0', 't2', 't1', 't3', 't7', 't6', 't5', 't4']);
        expect(ids(mirror(board, [], ['t5', 't6']))).toEqual(['t3', 't2', 't1', 't0', 't7', 't5', 't6', 't4']);
    });

    it('is its own inverse: two turns of the glass restore the board', () => {
        for (const board of [grid(4, 3), grid(3, 5), grid(6, 4, 22)]) {
            expect(ids(mirror(mirror(board)))).toEqual(ids(board));
        }
    });

    it('never moves a card more than once in a turn', () => {
        const swaps = lookingGlassSwaps(grid(5, 4), []);
        const touched = swaps.flatMap(({ a, b }) => [a, b]);
        expect(new Set(touched).size).toBe(touched.length);
    });
});
