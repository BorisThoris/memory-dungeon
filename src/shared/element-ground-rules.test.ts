import { describe, expect, it } from 'vitest';
import type { BoardState, RealmId, Tile, TileSuit } from './contracts';
import { createAlchemyLog } from './element-alchemy-rules';
import { castElement, elementCastPower } from './element-group-rules';
import { castElementalGround, groundAnchoredTileIds, readElementalGround } from './element-ground-rules';
import { applyRealmTurnToRun, boardHasTurnablePair, resolveRealmTurn } from './realm-weather-rules';
import { createNewRun } from './game';
import { isRealmWeatherTurn } from './realm-rules';

const makeTiles = (suit: TileSuit): Tile[] => Array.from({ length: 16 }, (_, i) => ({
    id: `t${i}`, pairKey: `p${Math.floor(i / 2)}`, symbol: `${i}`, label: `${i}`,
    state: i < 2 ? 'matched' : 'hidden',
    suit: i < 2 ? suit : (['tide', 'moss', 'ember', 'bone'] as const)[Math.floor(i / 2) % 4]
}));
const board = (tiles: Tile[], ground?: (TileSuit | null)[]): BoardState => ({
    tiles, columns: 4, rows: 4, level: 4, pairCount: 8, matchedPairs: 1, flippedTileIds: [],
    floorArchetypeId: null, featuredObjectiveId: null, elementalGround: ground
});
const castGround = (suit: TileSuit, realmId: RealmId = 'storm', previous?: (TileSuit | null)[], secondaryId: RealmId | null = null) => {
    const tiles = makeTiles(suit);
    const result = castElementalGround({ tiles, columns: 4, ground: previous ?? tiles.map(() => null), groupTileIds: ['t0', 't1'], suit, realmId, secondaryId, alchemy: createAlchemyLog() });
    return { tiles, result };
};

describe('a living elemental field', () => {
    it.each(['ember', 'tide', 'bone', 'moss'] as const)('every %s match leaves ground even after the last cards leave', (suit) => {
        const tiles = makeTiles(suit).map((tile) => ({ ...tile, state: 'matched' as const }));
        const result = castElementalGround({ tiles, columns: 4, ground: tiles.map(() => null), groupTileIds: ['t0', 't1'], suit, realmId: 'storm', secondaryId: null, alchemy: createAlchemyLog() });
        expect(result.cells).toBe(5);
        expect(result.ground.filter(Boolean)).toHaveLength(5);
        expect(result.ground[3]).toBeNull(); // No wrapping from the left edge.
        expect(result.touchedTileIds).toEqual([]);
    });

    it.each([
        ['ember', 'tide', 'Steam'], ['ember', 'frost', 'Thaw'], ['ember', 'grove', 'Blaze'],
        ['tide', 'frost', 'Freeze-over'], ['tide', 'grove', 'Flood'], ['moss', 'frost', 'Frostbloom']
    ] as const)('%s reacts with the underlying %s arena as %s', (suit, realm, reaction) => {
        expect(castGround(suit, realm).result.reaction).toBe(reaction);
    });

    it('written ground takes precedence over the arena, and a confluence contributes its second material', () => {
        const old = makeTiles('ember').map(() => 'moss' as const);
        expect(castGround('ember', 'tide', old).result.reaction).toBe('Blaze');
        expect(castGround('ember', 'ember', undefined, 'tide').result.reaction).toBe('Steam');
        expect(old.every((cell) => cell === 'moss')).toBe(true);
    });

    it('ice belongs to the cell, not the card; overwriting it removes its movement protection', () => {
        const { tiles, result } = castGround('bone', 'frost');
        expect(groundAnchoredTileIds(tiles, result.ground)).toContain('t4');
        [tiles[4], tiles[15]] = [tiles[15]!, tiles[4]!];
        expect(groundAnchoredTileIds(tiles, result.ground)).toContain('t15');
        expect(groundAnchoredTileIds(tiles, result.ground)).not.toContain('t4');
        const overwritten = castGround('ember', 'storm', result.ground).result;
        expect(groundAnchoredTileIds(tiles, overwritten.ground)).toEqual([]);
    });

    it('roots pay only when matching on previously planted ground, once even for a big pop', () => {
        const initial = castGround('moss', 'grove').result;
        expect(initial.gold).toBe(0);
        expect(castGround('tide', 'grove', initial.ground).result.gold).toBe(1);
        const sparse = makeTiles('ember').map(() => null as TileSuit | null);
        sparse[4] = 'moss'; // A neighbour is not a matched source cell.
        expect(castGround('ember', 'storm', sparse).result.gold).toBe(0);
    });

    it('Steam reveals live neighbours; Frostbloom charges them once through the shared ledger', () => {
        const steam = castGround('ember', 'tide');
        expect(steam.result.quenchFire).toBe(true);
        expect(steam.result.litTileIds).toEqual(['t4']);
        const tiles = makeTiles('moss');
        const alchemy = createAlchemyLog();
        const result = castElementalGround({ tiles, columns: 4, ground: tiles.map(() => null), groupTileIds: ['t0', 't1'], suit: 'moss', realmId: 'frost', secondaryId: null, alchemy });
        expect(result.touchedTileIds).toHaveLength(1);
        castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'frost', pinned: new Set(), alchemy });
        expect(tiles[4]!.empowered).toBe(1);
    });

    it('old and malformed fields are safe and confined to the board', () => {
        expect(readElementalGround(board(makeTiles('ember')))).toEqual(Array(16).fill(null));
        const malformed = board(makeTiles('ember'), ['bone', 'bogus', ...Array(30).fill('tide')] as TileSuit[]);
        expect(readElementalGround(malformed)).toHaveLength(16);
        expect(readElementalGround(malformed)[1]).toBeNull();
    });
});

describe('every match casts, with transparent scaling', () => {
    it('both halves of a raging confluence answer the missed cards', () => {
        const tiles = makeTiles('ember');
        const run = { ...createNewRun(0, { realm: { realmId: 'ember', severity: 'raging' } }), realmSecondaryId: 'grove' as const };
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'miss', tileIds: ['t6', 't4'], sourceTiles: [tiles[6]!, tiles[4]!], turnsThisFloor: 1, pinnedTileIds: [] });
        expect(result.events.map((event) => event.kind)).toEqual(expect.arrayContaining(['scald', 'snare']));
        expect(result.backlashes).toBe(2);
    });

    it('tipping a deep arena uses the new arena depth immediately', () => {
        const tiles = makeTiles('bone');
        const run = { ...createNewRun(0, { realm: { realmId: 'ember', severity: 'calm' } }), realmSway: { bone: 4 }, realmAttunement: { ember: 9 } };
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'match', tileIds: ['t0', 't1'], groupTileIds: ['t0', 't1'], sourceTiles: tiles.slice(0, 2), turnsThisFloor: 1, pinnedTileIds: [], pairsBySuit: { bone: 1 } });
        expect(result.realmId).toBe('frost');
        expect(result.resonance.bone).toBe(1);
    });

    it('a confluence grants its secondary element the depth resonance bonus too', () => {
        const tiles = makeTiles('moss');
        const run = { ...createNewRun(0, { realm: { realmId: 'storm', severity: 'calm' } }), realmSecondaryId: 'grove' as const, realmAttunement: { grove: 6 } };
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'match', tileIds: ['t0', 't1'], groupTileIds: ['t0', 't1'], sourceTiles: tiles.slice(0, 2), turnsThisFloor: 1, pinnedTileIds: [], pairsBySuit: { moss: 1 } });
        expect(result.resonance.moss).toBe(3);
    });

    it.each(['ember', 'bone', 'moss'] as const)('a single %s pair acts without a pop, skipping immune cards', (suit) => {
        const tiles = makeTiles(suit);
        const cast = castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'storm', pinned: new Set() })!;
        const status = suit === 'ember' ? 'fuse' : suit === 'bone' ? 'rime' : 'seeded';
        expect(tiles.filter((tile) => tile[status])).toHaveLength(2);
        expect(cast.touchedTileIds.length).toBeGreaterThan(0);
    });

    it('combo, resonance and pop size strengthen different parts of the cast', () => {
        expect(elementCastPower(0, 0)).toEqual({ extraReach: 0, targets: 2, blooming: false });
        expect(elementCastPower(3, 0)).toEqual({ extraReach: 1, targets: 2, blooming: false });
        expect(elementCastPower(6, 0)).toEqual({ extraReach: 2, targets: 3, blooming: true });
        expect(elementCastPower(0, 2)).toEqual({ extraReach: 2, targets: 3, blooming: true });
        expect(elementCastPower(0, 0, 2).targets).toBe(3);
        expect(elementCastPower(9000, 200).targets).toBe(6);
        expect(elementCastPower(9000, 200).extraReach).toBe(3200);
    });

    it('a stronger Grove cast finishes the next two-card block with four playable blooms', () => {
        const tiles = makeTiles('moss');
        castElement({ tiles, columns: 4, groupTileIds: ['t0', 't1'], realmId: 'grove', pinned: new Set(), combo: 6 });
        expect(tiles.filter((tile) => tile.seeded === 2)).toHaveLength(4);
    });

    it('the full resolver keeps one playable pair, records every cast, and preserves tile identity', () => {
        for (const suit of ['ember', 'tide', 'bone', 'moss'] as const) {
            const tiles = makeTiles(suit);
            const run = createNewRun(0, { realm: { realmId: 'storm', severity: 'calm' } });
            const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'match', tileIds: ['t0', 't1'], groupTileIds: ['t0', 't1'], sourceTiles: tiles.slice(0, 2), turnsThisFloor: 1, pinnedTileIds: [], pairsBySuit: { [suit]: 1 } });
            expect(result.casts).toBe(1);
            expect(result.board.elementCast?.suit).toBe(suit);
            expect(result.board.elementCast?.sourceCells).toEqual([0, 1]);
            expect(result.board.elementCast?.contacts.every(contact => result.board.tiles[contact.cell]?.id === contact.tileId)).toBe(true);
            expect(result.board.elementalGround?.filter(Boolean).length).toBeGreaterThan(0);
            expect(result.events.some((event) => event.ground?.cells === 5)).toBe(true);
            expect(boardHasTurnablePair(result.board.tiles)).toBe(true);
            expect(result.board.tiles.map((tile) => tile.id).sort()).toEqual(tiles.map((tile) => tile.id).sort());
            expect(applyRealmTurnToRun(run, result).board).toBe(result.board);
            expect(applyRealmTurnToRun(run, result).lastElementCastEvent?.ground?.cells).toBe(5);
            expect(tiles.some((tile) => tile.fuse || tile.frost || tile.vined)).toBe(false);
        }
    });

    it('amplified Thaw suppresses Fire ignition just like local Thaw', () => {
        const tiles = makeTiles('ember');
        const run = { ...createNewRun(0, { realm: { realmId: 'storm', severity: 'calm' } }), elementStreak: { suit: 'bone' as const, links: 2 } };
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'match', tileIds: ['t0', 't1'], groupTileIds: ['t0', 't1'], sourceTiles: tiles.slice(0, 2), turnsThisFloor: 1, pinnedTileIds: [], pairsBySuit: { ember: 1 } });
        expect(result.board.tiles.some(tile => tile.fuse != null)).toBe(false);
        expect(result.board.elementCast?.detail).toContain('Amplified Thaw ×2');
        expect(result.scoreDelta).toBe(100);
    });

    it('rime melted by a reaction stops anchoring cards before the same turn’s lightning', () => {
        const tiles = makeTiles('ember').map(tile => ({ ...tile, suit: 'ember' as const, ...(tile.state === 'hidden' ? { rime: true } : {}) }));
        const run = { ...createNewRun(0, { realm: { realmId: 'storm', severity: 'raging' } }), elementStreak: { suit: 'bone' as const, links: 2 } };
        const turn = [1, 2, 3, 4, 5, 6].find(value => isRealmWeatherTurn('storm', 'raging', value))!;
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'match', tileIds: ['t0', 't1'], groupTileIds: ['t0', 't1'], sourceTiles: tiles.slice(0, 2), turnsThisFloor: turn, pinnedTileIds: [], pairsBySuit: { ember: 1 } });
        expect(result.board.tiles.some(tile => tile.rime)).toBe(false);
        expect(result.events.find(event => event.kind === 'lightning')?.tileIds.length).toBeGreaterThan(0);
    });

    it('a Freeze-over protects its creation turn from weather and a far-away expiring fuse', () => {
        const tiles = makeTiles('bone');
        tiles[15] = { ...tiles[15]!, suit: 'moss', fuse: 1 };
        const run = { ...createNewRun(0, { realm: { realmId: 'ember', severity: 'raging' } }), elementStreak: { suit: 'tide' as const, links: 2 } };
        const result = resolveRealmTurn({ run, board: board(tiles), outcome: 'match', tileIds: ['t0', 't1'], groupTileIds: ['t0', 't1'], sourceTiles: tiles.slice(0, 2), turnsThisFloor: 2, pinnedTileIds: [], pairsBySuit: { bone: 1 } });
        expect(result.weather).toBe(0);
        expect(result.burnouts).toBe(0);
        expect(result.board.tiles[15]!.fuse).toBeUndefined();
        expect(result.stillTurns).toBe(3);
    });
});
