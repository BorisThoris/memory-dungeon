import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { applySkittishFlinch, orthogonalNeighbourIndices, resolveSkittishFlinch } from './skittish-cards-rules';

/** Rows of space-separated pair keys; the first card of a key is `-1`, the second `-2`. */
const board = (rows: string[]): BoardState => {
    const seen = new Map<string, number>();
    const tiles: Tile[] = rows.flatMap((row) =>
        row.split(' ').map((key) => {
            const n = (seen.get(key) ?? 0) + 1;
            seen.set(key, n);
            return { id: `${key}-${n}`, pairKey: key, symbol: key, label: key, state: 'hidden', suit: 'ember' } as Tile;
        })
    );
    return {
        level: 11,
        columns: rows[0]!.split(' ').length,
        rows: rows.length,
        pairCount: seen.size,
        matchedPairs: 0,
        flippedTileIds: [],
        tiles
    } as unknown as BoardState;
};

const flinch = (b: BoardState, missedTileIds: string[], pinnedTileIds: string[] = []) =>
    resolveSkittishFlinch({ board: b, missedTileIds, pinnedTileIds, turnsThisFloor: 3, runSeed: 42, rulesVersion: 1 });

describe('skittish cards', () => {
    it('knows a cell’s orthogonal neighbours, and nothing across the row edge', () => {
        expect(orthogonalNeighbourIndices(4, 3, 9)).toEqual([1, 7, 3, 5]);
        expect(orthogonalNeighbourIndices(0, 3, 9)).toEqual([3, 1]);
        expect(orthogonalNeighbourIndices(8, 3, 9)).toEqual([5, 7]);
        expect(orthogonalNeighbourIndices(2, 3, 9)).toEqual([5, 1]);
    });

    it('moves each missed card one step, into a neighbour, and no card twice', () => {
        const b = board(['a b c', 'd e f', 'c a b', 'd e f']);
        const result = flinch(b, ['a-1', 'b-1']);
        expect(result.kind).toBe('flinch');
        const touched = result.swaps.flatMap((swap) => [swap.a, swap.b]);
        expect(new Set(touched).size).toBe(touched.length);
        for (const swap of result.swaps) {
            expect(['a-1', 'b-1']).toContain(b.tiles[swap.a]!.id);
            expect(orthogonalNeighbourIndices(swap.a, b.columns, b.tiles.length)).toContain(swap.b);
        }
    });

    it('never trades a card with its own partner, which would look like nothing moved', () => {
        const b = board(['a a', 'b b']);
        const result = flinch(b, ['a-1', 'b-1']);
        for (const swap of result.swaps) {
            expect(b.tiles[swap.a]!.pairKey).not.toBe(b.tiles[swap.b]!.pairKey);
        }
    });

    it('leaves pinned cards alone on both sides of a swap', () => {
        const b = board(['a b c', 'd e f', 'a b c', 'd e f']);
        // b-1 sits at index 1; its neighbours are a-1 (0), c-1 (2) and e-1 (4).
        expect(flinch(b, ['b-1'], ['a-1', 'c-1', 'e-1']).kind).toBe('nothing_to_move');
        expect(flinch(b, ['b-1'], ['b-1']).kind).toBe('nothing_to_move');
    });

    it('only trades with cards that are still face down', () => {
        const b = board(['a b c', 'd e f', 'a b c', 'd e f']);
        const cleared = {
            ...b,
            tiles: b.tiles.map((tile) => (tile.id === 'b-1' || tile.id === 'e-1' ? tile : { ...tile, state: 'matched' as const }))
        };
        // b-1 and e-1 neighbour each other, but they are the two cards of the miss and differ, so
        // they may trade with each other and nothing else.
        const result = flinch(cleared, ['b-1', 'e-1']);
        for (const swap of result.swaps) {
            expect([cleared.tiles[swap.a]!.id, cleared.tiles[swap.b]!.id].sort()).toEqual(['b-1', 'e-1']);
        }
    });

    it('flinches the same way on a replay, and the flinch moves only the cards it names', () => {
        const b = board(['a b c', 'd e f', 'a b c', 'd e f']);
        const first = flinch(b, ['a-1', 'e-1']);
        expect(flinch(b, ['a-1', 'e-1'])).toEqual(first);
        const after = applySkittishFlinch(b, first.swaps);
        const touched = new Set(first.swaps.flatMap((swap) => [swap.a, swap.b]));
        for (const swap of first.swaps) {
            expect(after.tiles[swap.a]!.id).toBe(b.tiles[swap.b]!.id);
            expect(after.tiles[swap.b]!.id).toBe(b.tiles[swap.a]!.id);
        }
        b.tiles.forEach((tile, index) => {
            if (!touched.has(index)) expect(after.tiles[index]!.id).toBe(tile.id);
        });
    });
});
