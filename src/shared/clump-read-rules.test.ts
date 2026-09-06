import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileSuit } from './contracts';
import { getClumpRead } from './clump-read-rules';
import { makeBoard, makeTile } from './test/game-fixtures';

/*
 * 4 x 3, same shape as the chunk tests: A, B, C are ember and connected; D, E, F are tide.
 *   A1 B1 C1 D1
 *   A2 B2 E1 F1
 *   D2 C2 E2 F2
 */
const suit = (id: string): TileSuit => (['A', 'B', 'C'].includes(id[0]!) ? 'ember' : 'tide');
const tile = (id: string, extra: Partial<Tile> = {}): Tile => makeTile(id, id[0]!, id[0]!, { suit: suit(id), ...extra });
const layout = (): Tile[] => [
    tile('A1'), tile('B1'), tile('C1'), tile('D1'),
    tile('A2'), tile('B2'), tile('E1'), tile('F1'),
    tile('D2'), tile('C2'), tile('E2'), tile('F2')
];
const board = (tiles: Tile[] = layout()): BoardState => makeBoard(tiles, { columns: 4, rows: 3, level: 3 });

describe('the clump read', () => {
    it('reads the whole connected same-suit region, the tile included, and the pairs a Sharp break would take', () => {
        const read = getClumpRead(board(), 'A1');
        expect(read?.suit).toBe('ember');
        expect(read?.size).toBe(6);
        expect(read?.tileIds.sort()).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
        // A's own pair is the match; B and C go with the break.
        expect(read?.pairsSharpWouldTake).toBe(2);
    });

    it('counts a pair only when both halves can go, the way the break does', () => {
        const withExit = layout().map((t) => (t.id === 'C2' ? { ...t, dungeonCardKind: 'exit' as const } : t));
        expect(getClumpRead(board(withExit), 'A1')?.pairsSharpWouldTake).toBe(1);
    });

    it('is a lone tile when its neighbours are another suit, and nothing for a face-up or removed tile', () => {
        // D2 sits under A2 and beside C2, both ember. (D1 is not lone: F1 below it is tide.)
        expect(getClumpRead(board(), 'D2')?.size).toBe(1);
        expect(getClumpRead(board(), 'D2')?.pairsSharpWouldTake).toBe(0);
        expect(getClumpRead(board(), 'D1')?.size).toBe(5);
        const flipped = layout().map((t) => (t.id === 'A1' ? { ...t, state: 'flipped' as const } : t));
        expect(getClumpRead(board(flipped), 'A1')).toBeNull();
        const gone = layout().map((t) => (t.pairKey === 'B' ? { ...t, state: 'removed' as const } : t));
        // With B gone, C is cut off from A: the clump is A alone.
        expect(getClumpRead(board(gone), 'A1')?.size).toBe(2);
        expect(getClumpRead(board(gone), 'B1')).toBeNull();
    });
});
