import { describe, expect, it } from 'vitest';
import type { Tile, TileSuit } from './contracts';
import { ELEMENT_REACH, castElement, cardsWithinReach, elementalContactGroups } from './element-group-rules';

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
        // The fire cards beside the match drink the cast (`chargeKin`): a charge each.
        expect(cast.touchedTileIds.sort()).toEqual(['c-1', 'c-2', 'd-1', 'd-2', 'e-1', 'e-2']);
        expect(at(tiles, 'c-1').fuse).toBe(3);
        expect(at(tiles, 'e-1').empowered).toBe(1);
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

    it('Frost kills fire and finishes the receiving block even past its two-card budget', () => {
        let tiles = matched(board(ROWS), 'd');
        tiles = tiles.map((tile) => (tile.id === 'c-1' ? { ...tile, fuse: 2 } : tile));
        const single = castElement({ tiles, columns: 4, groupTileIds: ['d-1', 'd-2'], realmId: 'ember', pinned: new Set() })!;
        expect(single.kind).toBe('freeze');
        expect(at(tiles, 'c-1').fuse).toBeUndefined();
        expect(tiles.filter((tile) => tile.frost).map(tile => tile.id).sort()).toEqual(['b-1', 'b-2', 'c-1', 'c-2', 'f-1', 'f-2']);
        const group = matched(matched(board(ROWS), 'd'), 'h');
        castElement({ tiles: group, columns: 4, groupTileIds: ['d-1', 'd-2', 'h-1', 'h-2'], realmId: 'ember', pinned: new Set() });
        expect(group.filter((tile) => tile.frost)).toHaveLength(6);
    });

    it('Grove finishes whole blocks for both single matches and popped groups', () => {
        const single = matched(board(ROWS), 'c');
        expect(castElement({ tiles: single, columns: 4, groupTileIds: ['c-1', 'c-2'], realmId: 'tide', pinned: new Set() })!.kind).toBe('entangle');
        expect(single.filter((tile) => tile.vined && tile.seeded)).toHaveLength(4);
        const group = matched(matched(board(ROWS), 'c'), 'g');
        castElement({ tiles: group, columns: 4, groupTileIds: ['c-1', 'c-2', 'g-1', 'g-2'], realmId: 'tide', pinned: new Set() });
        expect(group.filter((tile) => tile.vined && tile.seeded)).toHaveLength(8);
    });

    it('receiving blocks are connected by element, never through a gap or a different suit', () => {
        const tiles = board(['a:e b:t b:t c:m', 'a:e d:t c:m d:t']);
        expect(elementalContactGroups(tiles, 4, [1, 2, 3, 4, 5, 6, 7])).toEqual([[1, 5, 2], [3], [4, 0], [6], [7]]);
    });

    it('a higher multiplier carries more of the same reachable water targets', () => {
        const rows = ['a:t a:t b:e c:b b:e c:b', 'd:b e:e d:b e:e f:b g:e', 'g:e f:b h:e i:b h:e i:b'];
        const castAt = (multiplier: number) => {
            const tiles = matched(board(rows), 'a');
            return castElement({ tiles, columns: 6, groupTileIds: ['a-1', 'a-2'], realmId: 'tide', pinned: new Set(), tier: 1, multiplier })!;
        };
        expect(castAt(1).touchedTileIds).toHaveLength(8);
        expect(castAt(8).touchedTileIds.length).toBeGreaterThan(8);
    });

    it('an amplified cast finishes a ten-card block beyond its six-card budget', () => {
        const tiles = matched(board(['a:m a:m b:e b:e', 'c:e c:e d:e d:e', 'e:e e:e f:e f:e']), 'a');
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['a-1', 'a-2'], realmId: 'grove', pinned: new Set(), combo: 12, multiplier: 8 })!;
        expect(tiles.filter(t => t.vined && t.bloom && t.seeded === 2)).toHaveLength(8);
        expect(cast.power).toBe(6);
        expect(cast.contacts.filter(c => c.outcome === 'affected')).toHaveLength(8);
        expect(cast.contacts.filter(c => c.outcome === 'blocked')).toHaveLength(2);
        const free = tiles.filter(t => t.state === 'hidden' && !t.vined);
        expect(free.some(a => free.some(b => a.id !== b.id && a.pairKey === b.pairKey))).toBe(true);
    });

    it('fire records neutralization and kin absorption even on an otherwise clean board', () => {
        const tiles = matched(board(ROWS), 'a');
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['a-1', 'a-2'], realmId: 'ember', pinned: new Set() })!;
        expect(cast.contacts.some(c => c.suit === 'tide' && c.outcome === 'neutralized')).toBe(true);
        expect(cast.contacts.some(c => c.suit === 'ember' && c.outcome === 'charged')).toBe(true);
        expect(cast.contacts.every(c => tiles[c.cell]?.id === c.tileId)).toBe(true);
    });

    it('holds cover complete pairs while leaving a free pair', () => {
        for (const suit of ['moss', 'bone'] as const) {
            const tiles = matched(board(['a:m a:m b:t b:t', 'c:t c:t d:t d:t']), 'a');
            tiles[0] = { ...tiles[0]!, suit };
            tiles[1] = { ...tiles[1]!, suit };
            castElement({ tiles, columns: 4, groupTileIds: ['a-1', 'a-2'], realmId: 'storm', pinned: new Set(), combo: 12, multiplier: 8 });
            expect(tiles.filter(t => t.vined || t.frost)).toHaveLength(4);
            const free = tiles.filter(t => t.state === 'hidden' && !t.vined && !t.frost);
            expect(free).toHaveLength(2);
            expect(free[0]!.pairKey).toBe(free[1]!.pairKey);
        }
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
