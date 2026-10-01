import { describe, expect, it } from 'vitest';
import type { Tile, TileSuit } from './contracts';
import { ELEMENT_HOLD_CAP, ELEMENT_HOLD_CAP_GROUP, ELEMENT_REACH, castElement, cardsWithinReach } from './element-group-rules';

const SUITS: Record<string, TileSuit> = { e: 'ember', t: 'tide', m: 'moss', b: 'bone' };
/** A 4-column board from rows like 'a:e b:t c:m d:b'; ids are `${pairKey}-1` then `-2`. */
const board = (rows: string[]): Tile[] => {
    const seen: Record<string, number> = {};
    return rows.flatMap((row) =>
        row.split(' ').map((cell) => {
            const [pairKey, suit] = cell.split(':') as [string, string];
            seen[pairKey] = (seen[pairKey] ?? 0) + 1;
            return { id: `${pairKey}-${seen[pairKey]}`, pairKey, symbol: pairKey, label: pairKey, state: 'hidden', suit: SUITS[suit] } as Tile;
        })
    );
};
const ROWS = ['a:e b:t c:m d:b', 'e:e f:t a:e b:t', 'c:m d:b e:e f:t', 'g:m h:b g:m h:b'];
const at = (tiles: Tile[], id: string) => tiles.find((tile) => tile.id === id)!;
const matched = (tiles: Tile[], pairKey: string) => tiles.map((tile) => (tile.pairKey === pairKey ? { ...tile, state: 'matched' as const } : tile));

describe('elemental groups', () => {
    it('reaches face-down cards by steps from every card of the group, nearest first', () => {
        const tiles = board(ROWS);
        const reached = cardsWithinReach(tiles, 4, [0], ELEMENT_REACH);
        expect(reached.slice(0, 2).map((index) => tiles[index]!.id)).toEqual(['b-1', 'e-1']);
        expect(reached).not.toContain(0);
        expect(reached.every((index) => Math.floor(index / 4) + (index % 4) <= ELEMENT_REACH)).toBe(true);
    });

    it('Fire burns vines, ice and snow off the cards it reaches, and pays nothing', () => {
        let tiles = matched(board(ROWS), 'a');
        tiles = tiles.map((tile) => (tile.id === 'c-2' ? { ...tile, vined: true } : tile.id === 'd-2' ? { ...tile, frost: 2 } : tile));
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['a-1', 'a-2'], realmId: 'frost', pinned: new Set() })!;
        expect(cast.kind).toBe('scorch');
        expect(at(tiles, 'c-2').vined).toBeUndefined();
        expect(at(tiles, 'd-2').frost).toBeUndefined();
        expect(cast.touchedTileIds.sort()).toEqual(['c-2', 'd-2']);
    });

    it('Water puts fires out and washes the cards it reaches along, never a pinned one', () => {
        let tiles = matched(board(ROWS), 'b');
        tiles = tiles.map((tile) => (tile.id === 'e-1' ? { ...tile, fuse: 2 } : tile));
        const before = tiles.map((tile) => tile.id).join();
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['b-1', 'b-2'], realmId: 'ember', pinned: new Set(['a-1']) })!;
        expect(cast.kind).toBe('wash');
        expect(at(tiles, 'e-1').fuse).toBeUndefined();
        expect(tiles.map((tile) => tile.id).join()).not.toBe(before);
        expect(tiles[0]!.id).toBe('a-1');
    });

    it('Frost kills fire; only a popped group freezes, one card', () => {
        let tiles = matched(board(ROWS), 'd');
        tiles = tiles.map((tile) => (tile.id === 'c-1' ? { ...tile, fuse: 2 } : tile));
        const single = castElement({ tiles, columns: 4, groupTileIds: ['d-1', 'd-2'], realmId: 'ember', pinned: new Set() })!;
        expect(single.kind).toBe('freeze');
        expect(at(tiles, 'c-1').fuse).toBeUndefined();
        expect(tiles.filter((tile) => (tile.frost ?? 0) > 0)).toHaveLength(ELEMENT_HOLD_CAP);
        const group = matched(matched(board(ROWS), 'd'), 'h');
        castElement({ tiles: group, columns: 4, groupTileIds: ['d-1', 'd-2', 'h-1', 'h-2'], realmId: 'ember', pinned: new Set() });
        expect(group.filter((tile) => (tile.frost ?? 0) > 0)).toHaveLength(ELEMENT_HOLD_CAP_GROUP);
    });

    it('Grove: only a popped group snares, one card', () => {
        const single = matched(board(ROWS), 'c');
        expect(castElement({ tiles: single, columns: 4, groupTileIds: ['c-1', 'c-2'], realmId: 'tide', pinned: new Set() })!.kind).toBe('entangle');
        expect(single.filter((tile) => tile.vined)).toHaveLength(ELEMENT_HOLD_CAP);
        const group = matched(matched(board(ROWS), 'c'), 'g');
        castElement({ tiles: group, columns: 4, groupTileIds: ['c-1', 'c-2', 'g-1', 'g-2'], realmId: 'tide', pinned: new Set() });
        expect(group.filter((tile) => tile.vined)).toHaveLength(ELEMENT_HOLD_CAP_GROUP);
    });

    it('reaches further in its own realm', () => {
        const tiles = board(ROWS);
        expect(cardsWithinReach(tiles, 4, [0], 3).length).toBeGreaterThan(cardsWithinReach(tiles, 4, [0], ELEMENT_REACH).length);
    });

    it('casts nothing for a card without a suit', () => {
        const tiles = board(ROWS).map((tile) => (tile.pairKey === 'a' ? { ...tile, suit: undefined } : tile));
        expect(castElement({ tiles, columns: 4, groupTileIds: ['a-1', 'a-2'], realmId: 'tide', pinned: new Set() })).toBeNull();
    });
});
