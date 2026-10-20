import { describe, expect, it } from 'vitest';
import type { BoardFold } from './board-fold-rules';
import { foldCutsEdge, foldDoorCells, foldDoorOpenFor, foldRoomOf } from './board-fold-rules';
import { orthogonalNeighbours, resolveChunkBreak } from './chunk-break-rules';
import type { BoardState, Tile, TileSuit } from './contracts';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';

const SUITS: Record<string, TileSuit> = { e: 'ember', t: 'tide', m: 'moss', b: 'bone' };
/** A row-major board from `pairKey:suit` cells, as the test hall writes them. */
const board = (rows: readonly string[], fold?: BoardFold): BoardState => {
    const seen = new Map<string, number>();
    const tiles: Tile[] = rows.flatMap((row) =>
        row.trim().split(/\s+/).map((cell) => {
            const [pairKey, suit] = cell.split(':') as [string, string];
            const half = (seen.get(pairKey) ?? 0) + 1;
            seen.set(pairKey, half);
            return { id: `${pairKey}-${half}`, pairKey, symbol: pairKey, label: pairKey, state: 'hidden' as const, suit: SUITS[suit] ?? 'ember' };
        })
    );
    return {
        level: 13,
        columns: rows[0]!.trim().split(/\s+/).length,
        rows: rows.length,
        pairCount: seen.size,
        matchedPairs: 0,
        flippedTileIds: [],
        cursedPairKey: null,
        wardPairKey: null,
        bountyPairKey: null,
        featuredObjectiveId: null,
        tiles,
        ...(fold ? { fold } : {}),
        floorArchetypeId: null
    } as unknown as BoardState;
};
const FOLD: BoardFold = { afterColumn: 2, doorRows: [1] };

describe('the Fold (DGE-010)', () => {
    it('cuts the edges across the wall, opens them on the door rows, and never on a diagonal', () => {
        // 6 columns, the wall between columns 2 and 3.
        expect(foldCutsEdge(2, 3, 6, FOLD)).toBe(true);
        expect(foldCutsEdge(8, 9, 6, FOLD)).toBe(false);
        expect(foldCutsEdge(8, 9, 6, FOLD, false)).toBe(true);
        expect(foldCutsEdge(1, 2, 6, FOLD)).toBe(false);
        expect(foldCutsEdge(2, 9, 6, FOLD)).toBe(true);
        expect(foldCutsEdge(2, 3, 6, null)).toBe(false);
        expect(orthogonalNeighbours(2, 6, 12, FOLD)).toEqual([1, 8]);
        expect(orthogonalNeighbourIndices(8, 6, 12, FOLD)).toEqual([2, 7, 9]);
        // No fold, no change.
        expect(orthogonalNeighbours(2, 6, 12)).toEqual([1, 3, 8]);
    });

    it('names the door cells and the rooms', () => {
        const b = board(['a:e a:e b:t b:t c:m c:m', 'd:b d:b e:e e:e f:t f:t'], FOLD);
        expect(foldDoorCells(b)).toEqual([8, 9]);
        expect(foldDoorOpenFor(b, [7])).toBe(false);
        expect(foldDoorOpenFor(b, [7, 8])).toBe(true);
        expect([0, 2, 3, 5].map((i) => foldRoomOf(b, i))).toEqual([0, 0, 1, 1]);
    });

    // A Fever chain, so the pop reaches far enough to meet the wall; every room keeps a second fire pair, so
    // the drop (a suit that can no longer pop loses its last pairs) never takes one by mercy.
    const FEVER = 30;
    const pop = (b: BoardState, pairKey: string): string[] =>
        resolveChunkBreak({ board: b, run: { floorCurioId: null }, matchedTileIds: b.tiles.filter((t) => t.pairKey === pairKey).map((t) => t.id), chain: FEVER }).brokenPairKeys;
    const ROWS = [
        'x:t a:e a:e c:e c:e y:t',
        'k:e k:e w:m d:e d:e v:t',
        'g:e g:e w:m h:e h:e v:t',
        'x:t q:b q:b z:m z:m y:t'
    ];
    const WALL_AT_ROW_0: BoardFold = { afterColumn: 2, doorRows: [3] };

    it('a match beside the wall pops nothing through it', () => {
        expect(pop(board(ROWS), 'a')).toContain('c');
        const shut = pop(board(ROWS, WALL_AT_ROW_0), 'a');
        expect(shut).not.toContain('c');
        expect(shut).not.toContain('d');
        expect(shut).not.toContain('h');
    });

    it('a match in the doorway cascades through it', () => {
        expect(pop(board(ROWS, { afterColumn: 2, doorRows: [0] }), 'a')).toContain('c');
    });

    it('a match away from the doorway finds the door shut, even when its cascade reaches the door cell', () => {
        // The door is on row 1, where k stands against it; the match a is on row 0, away from it.
        const fold: BoardFold = { afterColumn: 2, doorRows: [1] };
        const rows = ['x:t a:e a:e c:e c:e y:t', 'k:e k:e k2:e d:e d:e v:t', 'g:e g:e k2:e h:e h:e v:t', 'x:t q:b q:b z:m z:m y:t'];
        const shut = pop(board(rows, fold), 'a');
        // Without the wall the same match does reach the far room, so the shut door is what stops it.
        expect(pop(board(rows), 'a').some((pairKey) => ['c', 'd', 'h'].includes(pairKey))).toBe(true);
        expect(shut).toEqual(expect.arrayContaining(['k2']));
        expect(shut.some((pairKey) => ['c', 'd', 'h'].includes(pairKey))).toBe(false);
        // The same board, matched from the doorway, crosses.
        const fromDoor = ['x:t z:m z:m c:e c:e y:t', 'k:e a:e a:e d:e d:e v:t', 'g:e g:e w:m h:e h:e v:t', 'x:t q:b q:b w:m k:e y:t'];
        expect(pop(board(fromDoor, fold), 'a')).toEqual(expect.arrayContaining(['d']));
    });
});
