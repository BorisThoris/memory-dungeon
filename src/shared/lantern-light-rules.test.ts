import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { LANTERN_MAX_LIT, resolveLanternLight } from './lantern-light-rules';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';

const board = (rows: string[], matched: readonly string[] = []): BoardState => {
    const seen = new Map<string, number>();
    const tiles: Tile[] = rows.flatMap((row) =>
        row.split(' ').map((key) => {
            const n = (seen.get(key) ?? 0) + 1;
            seen.set(key, n);
            const id = `${key}-${n}`;
            return { id, pairKey: key, symbol: key, label: key, state: matched.includes(key) ? 'matched' : 'hidden', suit: 'ember' } as Tile;
        })
    );
    return { level: 10, columns: rows[0]!.split(' ').length, rows: rows.length, pairCount: seen.size, matchedPairs: 0, flippedTileIds: [], tiles } as unknown as BoardState;
};

const light = (b: BoardState, matchedTileIds: string[]) =>
    resolveLanternLight({ board: b, matchedTileIds, turnsThisFloor: 2, runSeed: 7, rulesVersion: 1 });

describe('lantern light', () => {
    it('lights only face-down cards touching the matched pair, at most three', () => {
        const b = board(['a b c d', 'e x x f', 'a b c d', 'e g g f'], ['x']);
        const lit = light(b, ['x-1', 'x-2']);
        expect(lit.length).toBe(LANTERN_MAX_LIT);
        const touching = new Set(
            [5, 6].flatMap((index) => orthogonalNeighbourIndices(index, 4, 16)).map((index) => b.tiles[index]!.id)
        );
        for (const id of lit) {
            expect(touching.has(id)).toBe(true);
            expect(b.tiles.find((tile) => tile.id === id)?.state).toBe('hidden');
        }
    });

    it('lights everything touching when there are three or fewer, and nothing at a sealed corner', () => {
        const corner = board(['x x', 'a a'], ['x']);
        expect(light(corner, ['x-1', 'x-2']).sort()).toEqual(['a-1', 'a-2']);
        const sealed = board(['x y', 'y x'], ['x', 'y']);
        expect(light(sealed, ['x-1', 'x-2'])).toEqual([]);
    });

    it('lights the same cards on a replay', () => {
        const b = board(['a b c d', 'e x x f', 'a b c d', 'e g g f'], ['x']);
        expect(light(b, ['x-1', 'x-2'])).toEqual(light(b, ['x-1', 'x-2']));
    });
});
