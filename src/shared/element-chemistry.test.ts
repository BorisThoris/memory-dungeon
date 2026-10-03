import { describe, expect, it } from 'vitest';
import type { Tile, TileSuit } from './contracts';
import { createAlchemyLog } from './element-alchemy-rules';
import { castElement } from './element-group-rules';
import { castElementalGround } from './element-ground-rules';
import { ELEMENT_REACTIONS, resolveElementReaction } from './element-resonance-rules';
import { SUIT_REALM } from './realm-sway-rules';

const field = (suit: TileSuit): Tile[] => Array.from({ length: 12 }, (_, i) => ({
    id: `t${i}`, pairKey: `p${Math.floor(i / 2)}`, symbol: String(i), label: String(i),
    state: i < 2 ? 'matched' : 'hidden', suit: i < 2 ? suit : 'tide',
    ...(i >= 2 ? { fuse: 2, seeded: 1, rime: true, frost: 2, vined: true, bloom: true, snowed: true } : {})
}));

describe('one predictable elemental chemistry', () => {
    it.each(Object.values(ELEMENT_REACTIONS))('$name has the same recipe on ground and in a charged reaction', reaction => {
        for (const [suit, material] of [reaction.elements, [...reaction.elements].reverse()] as [TileSuit, TileSuit][]) {
            const local = field(suit);
            const charged = structuredClone(local);
            const localResult = castElementalGround({ tiles: local, columns: 4, ground: [], groupTileIds: ['t0', 't1'], suit,
                realmId: SUIT_REALM[material], secondaryId: null, alchemy: createAlchemyLog() });
            const sameRecipe = resolveElementReaction(reaction.kind, 1, charged, [4, 5, 2], createAlchemyLog());
            expect(local).toEqual(charged);
            expect(localResult).toMatchObject({ reaction: reaction.name, gold: sameRecipe.gold, score: sameRecipe.score,
                stillTurns: sameRecipe.stillTurns, resonanceGain: sameRecipe.resonanceGain, litTileIds: sameRecipe.litTileIds });
            expect(local[11]).toEqual(field(suit)[11]); // Ground chemistry stays local.
            expect(localResult.touchedTileIds.length + localResult.gold + localResult.score + localResult.stillTurns + localResult.resonanceGain).toBeGreaterThan(0);
        }
    });

    it('neighbour patches cannot unexpectedly change chemistry under a matched pair', () => {
        const tiles = field('ember');
        const ground: (TileSuit | null)[] = Array(12).fill(null);
        ground[0] = ground[1] = 'ember';
        ground[4] = 'tide';
        const result = castElementalGround({ tiles, columns: 4, ground, groupTileIds: ['t1', 't0'], suit: 'ember', realmId: 'grove', secondaryId: null, alchemy: createAlchemyLog() });
        expect(result.reaction).toBeNull();
        expect(result.ground[4]).toBe('ember');
        expect(result.gold).toBe(0);
    });

    it('matching source order cannot choose a different reaction; board order is stable', () => {
        const cast = (ids: string[]) => castElementalGround({ tiles: field('ember'), columns: 4, ground: ['bone', 'tide'], groupTileIds: ids,
            suit: 'ember', realmId: 'storm', secondaryId: null, alchemy: createAlchemyLog() });
        expect(cast(['t0', 't1'])).toEqual(cast(['t1', 't0']));
        expect(cast(['t0', 't1']).reaction).toBe('Thaw');
    });

    it('an extra popped pair cannot replace the selected pair as the chemistry source', () => {
        const tiles = field('ember');
        tiles[8] = { ...tiles[8]!, state: 'matched', suit: 'ember' };
        tiles[9] = { ...tiles[9]!, state: 'matched', suit: 'ember' };
        const ground: (TileSuit | null)[] = Array(12).fill(null);
        ground[0] = ground[1] = 'tide';
        ground[8] = ground[9] = 'moss';
        const result = castElementalGround({ tiles, columns: 4, ground, groupTileIds: ['t0', 't1', 't8', 't9'], reactionTileIds: ['t9', 't8'],
            suit: 'ember', realmId: 'frost', secondaryId: null, alchemy: createAlchemyLog() });
        expect(result.reaction).toBe('Blaze');
        expect(result.ground[0]).toBe('ember');
        expect(result.ground[9]).toBe('ember');
    });

    it('all six recipes amplify a useful resource, while preserving tile identities', () => {
        for (const reaction of Object.values(ELEMENT_REACTIONS)) {
            const lowTiles = field('ember');
            const highTiles = structuredClone(lowTiles);
            const nearest = Array.from({ length: 10 }, (_, i) => i + 2);
            const low = resolveElementReaction(reaction.kind, 1, lowTiles, nearest);
            const high = resolveElementReaction(reaction.kind, 4, highTiles, nearest);
            const value = (result: typeof low) => result.gold + result.score + result.stillTurns + result.resonanceGain
                + (reaction.kind === 'steam' ? result.litTileIds.length : reaction.kind === 'frostbloom' ? result.touchedTileIds.length : 0);
            expect(value(high), reaction.name).toBeGreaterThan(value(low));
            expect(highTiles.map(t => [t.id, t.pairKey, t.state])).toEqual(field('ember').map(t => [t.id, t.pairKey, t.state]));
        }
    });

    it('ice ground anchors movement without silently shielding cards from Grove or Frost', () => {
        for (const suit of ['moss', 'bone'] as const) {
            const tiles = field(suit).map(tile => ({ id: tile.id, pairKey: tile.pairKey, symbol: tile.symbol, label: tile.label, state: tile.state, suit: tile.suit }));
            const anchored = new Set(tiles.slice(2).map(tile => tile.id));
            castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'storm', pinned: new Set(), anchored });
            expect(tiles.slice(2).every(tile => suit === 'moss' ? 'seeded' in tile : 'rime' in tile)).toBe(true);
        }
        const tiles = field('tide').map(tile => ({ id: tile.id, pairKey: tile.pairKey, symbol: tile.symbol, label: tile.label, state: tile.state, suit: (tile.state === 'matched' ? 'tide' : 'ember') as TileSuit }));
        const before = tiles.map(tile => tile.id);
        castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'storm', pinned: new Set(), anchored: new Set(before) });
        expect(tiles.map(tile => tile.id)).toEqual(before);
    });

    it('Frostbloom and kin share one charge per turn, including the amplified reaction', () => {
        const tiles = field('tide').map(tile => ({ ...tile, suit: 'moss' as const }));
        const alchemy = createAlchemyLog();
        castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'grove', pinned: new Set(), alchemy });
        resolveElementReaction('frostbloom', 8, tiles, Array.from({ length: 10 }, (_, i) => i + 2), alchemy);
        expect(tiles.slice(2).every(t => t.empowered === 1)).toBe(true);
        expect(new Set(alchemy.empowered).size).toBe(alchemy.empowered.length);
    });

    it.each(['ember', 'bone', 'moss'] as const)('%s travels through a whole vulnerable block beyond its starting reach', suit => {
        const vulnerable = suit === 'ember' ? 'moss' : 'tide';
        const tiles = field(suit).map((tile, i) => ({ id: tile.id, pairKey: tile.pairKey, symbol: tile.symbol, label: tile.label, state: tile.state, suit: i < 2 ? suit : vulnerable } as Tile));
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'storm', pinned: new Set() })!;
        const status = suit === 'ember' ? 'fuse' : suit === 'bone' ? 'rime' : 'seeded';
        expect(tiles.slice(2).every(tile => Boolean(tile[status]))).toBe(true);
        expect(cast.contacts).toHaveLength(10);
        expect(new Set(cast.contacts.map(contact => contact.group)).size).toBe(1);
        expect(cast.power).toBe(2);
        expect(tiles.slice(2).every(tile => !tile.vined && !tile.frost && tile.state === 'hidden')).toBe(true);
    });
});
