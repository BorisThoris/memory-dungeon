import { describe, expect, it } from 'vitest';
import type { BoardState, RealmId, RealmSeverity, RunState, Tile, TileSuit } from './contracts';
import { TILE_SUITS } from './tile-suit-rules';
import { createNewRun } from './game';
import {
    ELEMENT_NEUTRALIZES,
    EMPOWERED_MATCH_GOLD,
    createAlchemyLog,
    elementAlchemy,
    elementLands,
    empoweredMatchGold
} from './element-alchemy-rules';
import { applyRealmTurnToRun, resolveRealmTurn } from './realm-weather-rules';
import { castElement } from './element-group-rules';

const card = (id: string, pairKey: string, suit?: TileSuit, extra: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden',
    ...(suit ? { suit } : {}),
    ...extra
});

const board = (tiles: Tile[], columns = 4): BoardState => ({
    level: 5,
    pairCount: tiles.length / 2,
    columns,
    rows: Math.ceil(tiles.length / columns),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
} as BoardState);

const runIn = (realmId: RealmId, severity: RealmSeverity = 'wild', extra: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 4242, realm: { realmId, severity } }),
    ...extra
});

describe('elemental alchemy', () => {
    it('every card drinks its own element and puts out exactly one other', () => {
        for (const suit of TILE_SUITS) {
            const tile = card('x', 'x', suit);
            const answers = TILE_SUITS.map((element) => elementAlchemy(tile, element));
            expect(elementAlchemy(tile, suit)).toBe('empowered');
            expect(elementAlchemy(tile, ELEMENT_NEUTRALIZES[suit])).toBe('neutralized');
            expect(answers.filter((answer) => answer === null)).toHaveLength(2);
        }
        // Each element is put out by exactly one other: the cycle closes.
        expect(new Set(Object.values(ELEMENT_NEUTRALIZES)).size).toBe(TILE_SUITS.length);
    });

    it('water puts out fire, fire melts frost, frost kills growth, roots hold against water', () => {
        expect(ELEMENT_NEUTRALIZES).toEqual({ tide: 'ember', ember: 'bone', bone: 'moss', moss: 'tide' });
    });

    it('a card without a suit, the joker and the singletons are no element', () => {
        expect(elementAlchemy(card('x', 'x'), 'ember')).toBeNull();
    });

    it('a kin card is empowered once, and pays when it is matched', () => {
        const tiles = [card('a', 'a', 'ember')];
        const log = createAlchemyLog();
        expect(elementLands(tiles, 0, 'ember', log)).toBe(false);
        expect(elementLands(tiles, 0, 'ember', log)).toBe(false);
        expect(tiles[0]!.empowered).toBe(true);
        expect(log.empowered).toEqual(['a']);
        expect(empoweredMatchGold(tiles)).toBe(EMPOWERED_MATCH_GOLD);
    });

    it('frostbite: a miss in the frost freezes neither a frost card nor a fire card', () => {
        const tiles = [card('a1', 'a', 'bone'), card('b1', 'b', 'ember'), card('c1', 'c', 'tide'), card('d1', 'd', 'moss'), card('a2', 'a', 'bone'), card('b2', 'b', 'ember'), card('c2', 'c', 'tide'), card('d2', 'd', 'moss')];
        const result = resolveRealmTurn({
            run: runIn('frost', 'calm'),
            board: board(tiles),
            outcome: 'miss',
            tileIds: ['a1', 'b1', 'c1', 'd1'],
            sourceTiles: tiles.slice(0, 4),
            turnsThisFloor: 1,
            pinnedTileIds: []
        });
        const by = (id: string) => result.board.tiles.find((tile) => tile.id === id)!;
        expect(by('a1').frost).toBeUndefined();
        expect(by('a1').empowered).toBe(true);
        expect(by('b1').frost).toBeUndefined();
        expect(by('b1').empowered).toBeUndefined();
        expect(by('c1').frost).toBeGreaterThan(0);
        expect(by('d1').frost).toBeGreaterThan(0);
        expect(result.empowered).toBe(1);
        expect(result.neutralized).toBe(1);
        expect(result.events.map((event) => event.kind)).toEqual(expect.arrayContaining(['frostbite', 'neutralized', 'empowered']));
        // The HUD names the frostbite, not the alchemy it met.
        expect(applyRealmTurnToRun(runIn('frost', 'calm'), result).lastRealmEvent?.kind).toBe('frostbite');
        expect(applyRealmTurnToRun(runIn('frost', 'calm'), result).elementEmpoweredThisFloor).toBe(1);
    });

    it('a matched empowered pair pays its gold', () => {
        const tiles = [card('a1', 'a', 'ember', { empowered: true, state: 'matched' }), card('a2', 'a', 'ember', { state: 'matched' }), card('b1', 'b', 'tide'), card('b2', 'b', 'tide')];
        const result = resolveRealmTurn({
            run: runIn('storm', 'calm'),
            board: board(tiles, 2),
            outcome: 'match',
            tileIds: ['a1', 'a2'],
            sourceTiles: tiles.slice(0, 2),
            turnsThisFloor: 1,
            pinnedTileIds: []
        });
        expect(result.goldDelta).toBe(EMPOWERED_MATCH_GOLD);
        expect(result.events.find((event) => event.kind === 'released')?.gold).toBe(EMPOWERED_MATCH_GOLD);
    });

    it('a hold spent on an immune card holds nothing', () => {
        // Two popped bone pairs; the nearest card is a fire card, which melts the frost.
        const tiles = [
            card('a1', 'a', 'bone', { state: 'matched' }),
            card('b1', 'b', 'bone', { state: 'matched' }),
            card('c1', 'c', 'ember'),
            card('a2', 'a', 'bone', { state: 'matched' }),
            card('b2', 'b', 'bone', { state: 'matched' }),
            card('c2', 'c', 'ember')
        ];
        const log = createAlchemyLog();
        castElement({ tiles, columns: 3, groupTileIds: ['a1', 'a2', 'b1', 'b2'], realmId: null, pinned: new Set(), alchemy: log });
        expect(tiles.some((tile) => (tile.frost ?? 0) > 0)).toBe(false);
        expect(log.neutralized).toHaveLength(1);
    });

    it('the current flows around water and grove cards', () => {
        const tiles = [card('a1', 'a', 'tide'), card('b1', 'b', 'ember'), card('c1', 'c', 'bone'), card('d1', 'd', 'moss')];
        const run = runIn('tide', 'raging');
        // One column: tide, ember, bone, moss. Only the ember and the bone can be carried.
        const result = resolveRealmTurn({ run, board: board(tiles, 1), outcome: 'match', tileIds: [], sourceTiles: [], turnsThisFloor: 2, pinnedTileIds: [] });
        expect(result.board.tiles[0]!.id).toBe('a1');
        expect(result.board.tiles[3]!.id).toBe('d1');
        expect(result.board.tiles[0]!.empowered).toBe(true);
    });
});
