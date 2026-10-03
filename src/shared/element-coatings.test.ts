import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { castElement } from './element-group-rules';
import { groundAnchoredTileIds } from './element-ground-rules';
import { createNewRun } from './game';
import { isTileFlipBlocked, resolveRealmTurn } from './realm-weather-rules';

const deal = (): Tile[] => Array.from({ length: 16 }, (_, i) => ({
    id: String(i), pairKey: String(Math.floor(i / 2)), label: 'test', symbol: 'test',
    state: i < 2 ? 'matched' : 'hidden', suit: i < 2 ? 'moss' : 'ember'
}));
const cast = (tiles: Tile[], suit: Tile['suit']) => {
    tiles[0] = { ...tiles[0]!, suit }; tiles[1] = { ...tiles[1]!, suit };
    return castElement({ tiles, columns: 4, groupTileIds: ['0', '1'], realmId: 'storm', pinned: new Set(groundAnchoredTileIds(tiles, [])) });
};
describe('playable elemental preparations', () => {
    it('Grove plants, Water cultivates, and matching harvests without ever locking a flip', () => {
        const tiles = deal();
        cast(tiles, 'moss');
        const seeded = tiles.filter(t => t.seeded);
        expect(seeded).toHaveLength(14);
        expect(seeded.every(t => !isTileFlipBlocked(t))).toBe(true);
        cast(tiles, 'tide');
        expect(tiles.filter(t => t.seeded === 2)).toHaveLength(14);
        const sourceTiles = tiles.filter(t => t.pairKey === '1');
        const board: BoardState = { level: 1, pairCount: 8, columns: 4, rows: 4, matchedPairs: 1,
            flippedTileIds: [], tiles: tiles.map(t => t.pairKey === '1' ? { ...t, state: 'matched' } : t),
            floorArchetypeId: null, featuredObjectiveId: null };
        const run = createNewRun(0, { runSeed: 1, realm: { realmId: 'storm', severity: 'calm' } });
        const result = resolveRealmTurn({ run, board, sourceTiles, tileIds: sourceTiles.map(t => t.id),
            outcome: 'match', turnsThisFloor: 1, pinnedTileIds: [] });
        expect(result.events.find(e => e.key.endsWith('seed-harvest'))?.gold).toBe(4);
    });
    it('Fire consumes vulnerable seeds and rime without harvesting their value', () => {
        const tiles = deal().map(t => t.state === 'hidden' ? { ...t, suit: 'moss' as const, seeded: 2, rime: true } : t);
        cast(tiles, 'ember');
        expect(tiles.find(t => t.id === '2')?.seeded).toBeUndefined();
        expect(tiles.find(t => t.id === '2')?.rime).toBeUndefined();
    });
    it('Frost replaces seeds with playable anchors; Water and Grove respect the anchor', () => {
        const tiles = deal().map(t => t.state === 'hidden' ? { ...t, suit: 'tide' as const, seeded: 1 } : t);
        cast(tiles, 'bone');
        const rimed = tiles.filter(t => t.rime);
        expect(rimed).toHaveLength(14);
        expect(rimed.every(t => !t.seeded && !isTileFlipBlocked(t))).toBe(true);
        const cells = rimed.map(t => tiles.indexOf(t));
        cast(tiles, 'tide'); cast(tiles, 'moss');
        expect(cells.map(i => tiles[i]!.id)).toEqual(rimed.map(t => t.id));
        expect(cells.every(i => tiles[i]!.rime && !tiles[i]!.seeded)).toBe(true);
    });
    it('matching rime banks a calm turn that suppresses the next arena hazard', () => {
        const tiles = deal();
        const sourceTiles = tiles.slice(0, 2).map(t => ({ ...t, rime: true }));
        const board: BoardState = { level: 1, pairCount: 8, columns: 4, rows: 4, matchedPairs: 1,
            flippedTileIds: [], tiles, floorArchetypeId: null, featuredObjectiveId: null };
        const run = createNewRun(0, { runSeed: 1, realm: { realmId: 'frost', severity: 'raging' } });
        const match = resolveRealmTurn({ run, board, sourceTiles, tileIds: ['0', '1'], outcome: 'match', turnsThisFloor: 1, pinnedTileIds: [] });
        expect(match.stillTurns).toBe(1);
        const miss = resolveRealmTurn({ run: { ...run, realmStillTurns: match.stillTurns }, board: match.board,
            sourceTiles: tiles.slice(2, 4), tileIds: ['2', '3'], outcome: 'miss', turnsThisFloor: 2, pinnedTileIds: [] });
        expect(miss.frozen).toBe(0);
        expect(miss.weather).toBe(0);
        expect(miss.stillTurns).toBe(0);
    });
});
