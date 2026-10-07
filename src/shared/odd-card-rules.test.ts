import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileSuit } from './contracts';
import { raiseColossus } from './colossus-rules';
import {
    dealOddCards,
    HOURGLASS_FROM_FLOOR,
    HOURGLASS_GOLD,
    HOURGLASS_SCORE,
    hourglassTurnsForPairs,
    ODD_CARD_MIN_PAIRS,
    ODD_CARD_RULES_FROM,
    resolveOddCardTurn,
    TURNCOAT_FROM_FLOOR,
    turncoatNextSuit
} from './odd-card-rules';
import { makeBoard, makeTile } from './test/game-fixtures';

const deck = (pairs: number, suits: readonly TileSuit[] = ['ember', 'tide', 'moss']): Tile[] =>
    Array.from({ length: pairs * 2 }, (_, cell) => {
        const pair = Math.floor(cell / 2);
        return makeTile(`p${pair}-${cell % 2 === 0 ? 'a' : 'b'}`, `p${pair}`, `P${pair}`, { suit: suits[pair % suits.length]! });
    });
const board = (pairs = 8, level = 6, extra: Partial<BoardState> = {}, suits?: readonly TileSuit[]): BoardState =>
    makeBoard(deck(pairs, suits), { level, columns: 4, rows: Math.ceil((pairs * 2) / 4), pairCount: pairs, ...extra });
const deal = (b: BoardState, runSeed: number, rulesVersion = ODD_CARD_RULES_FROM): BoardState => dealOddCards(b, { runSeed, rulesVersion });
const pairsWith = (b: BoardState, has: (tile: Tile) => boolean): string[] => [...new Set(b.tiles.filter(has).map((tile) => tile.pairKey))];
const setPair = (b: BoardState, pairKey: string, edit: (tile: Tile) => Tile): BoardState => ({ ...b, tiles: b.tiles.map((tile) => (tile.pairKey === pairKey ? edit(tile) : tile)) });
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);

describe('dealing the odd cards', () => {
    it('deals nothing before the rules that have them, or on a floor too small to spare a pair', () => {
        for (const seed of SEEDS) {
            expect(deal(board(), seed, ODD_CARD_RULES_FROM - 1).tiles.some((tile) => tile.turncoat != null || tile.hourglass != null)).toBe(false);
            expect(deal(board(ODD_CARD_MIN_PAIRS - 1), seed).tiles.some((tile) => tile.turncoat != null || tile.hourglass != null)).toBe(false);
        }
    });

    it('is the same deal for the same seed and floor, on about half the floors each', () => {
        let turncoats = 0;
        let hourglasses = 0;
        for (const seed of SEEDS) {
            const dealt = deal(board(), seed);
            expect(deal(board(), seed)).toEqual(dealt);
            turncoats += pairsWith(dealt, (tile) => tile.turncoat != null).length;
            hourglasses += pairsWith(dealt, (tile) => tile.hourglass != null).length;
        }
        expect(turncoats).toBeGreaterThan(70);
        expect(turncoats).toBeLessThan(130);
        expect(hourglasses).toBeGreaterThan(70);
        expect(hourglasses).toBeLessThan(130);
    });

    it('marks whole pairs, never the same pair twice, and only plain ones', () => {
        const taken = (b: BoardState): BoardState => ({
            ...setPair(setPair(setPair(b, 'p0', (tile) => ({ ...tile, findableKind: 'score_glint' })), 'p1', (tile) => ({ ...tile, tileTraitKind: 'heavy' })), 'p2', (tile) => ({ ...tile, frost: 2 })),
            wardPairKey: 'p3',
            bountyPairKey: 'p4',
            cursedPairKey: 'p5'
        });
        for (const seed of SEEDS) {
            const dealt = deal(taken(board()), seed);
            const turncoat = pairsWith(dealt, (tile) => tile.turncoat != null);
            const hourglass = pairsWith(dealt, (tile) => tile.hourglass != null);
            expect(turncoat.length).toBeLessThanOrEqual(1);
            expect(hourglass.length).toBeLessThanOrEqual(1);
            for (const pairKey of [...turncoat, ...hourglass]) {
                expect(['p6', 'p7']).toContain(pairKey);
                const halves = dealt.tiles.filter((tile) => tile.pairKey === pairKey);
                expect(halves[0]!.turncoat).toBe(halves[1]!.turncoat);
                expect(halves[0]!.hourglass).toBe(halves[1]!.hourglass);
            }
            expect(turncoat.filter((pairKey) => hourglass.includes(pairKey))).toEqual([]);
        }
    });

    it('keeps each card to its floors: no Hourglass before its floor, no Turncoat before its own or on a floor of one element', () => {
        for (const seed of SEEDS) {
            expect(pairsWith(deal(board(8, HOURGLASS_FROM_FLOOR - 1), seed), (tile) => tile.hourglass != null)).toEqual([]);
            expect(pairsWith(deal(board(8, TURNCOAT_FROM_FLOOR - 1), seed), (tile) => tile.turncoat != null)).toEqual([]);
            expect(pairsWith(deal(board(8, 6, {}, ['ember']), seed), (tile) => tile.turncoat != null)).toEqual([]);
        }
    });

    it('always gives a floor a Colossus stands over a Turncoat, promising an element another pair holds', () => {
        for (const seed of SEEDS) {
            const boss = raiseColossus(board(8, 7, { floorTag: 'boss' }), { runSeed: seed, rulesVersion: ODD_CARD_RULES_FROM });
            const dealt = deal(boss, seed);
            const halves = dealt.tiles.filter((tile) => tile.turncoat != null);
            expect(halves).toHaveLength(2);
            expect(halves[0]!.turncoat).not.toBe(halves[0]!.suit);
            expect(dealt.tiles.some((tile) => tile.turncoat == null && tile.suit === halves[0]!.turncoat)).toBe(true);
        }
    });

    it('gives the sand by the size of the floor', () => {
        expect(hourglassTurnsForPairs(6)).toBe(4);
        expect(hourglassTurnsForPairs(8)).toBe(5);
        expect(hourglassTurnsForPairs(12)).toBe(7);
        expect(hourglassTurnsForPairs(40)).toBe(9);
    });
});

describe('a turn for the Turncoat', () => {
    const marked = (): BoardState => setPair(board(), 'p0', (tile) => ({ ...tile, turncoat: 'tide' }));
    const p0 = (b: BoardState): Tile[] => b.tiles.filter((tile) => tile.pairKey === 'p0');

    it('becomes what it promised, both halves, and promises the next element in play', () => {
        const once = resolveOddCardTurn({ board: marked(), turnsThisFloor: 1 });
        expect(once.turned).toBe(1);
        expect(p0(once.board).map((tile) => [tile.suit, tile.turncoat])).toEqual([['tide', 'moss'], ['tide', 'moss']]);
        const twice = resolveOddCardTurn({ board: once.board, turnsThisFloor: 2 });
        expect(p0(twice.board).map((tile) => [tile.suit, tile.turncoat])).toEqual([['moss', 'ember'], ['moss', 'ember']]);
    });

    it('skips an element no other standing pair holds', () => {
        // Every moss pair gone: after water comes fire.
        const noMoss: BoardState = { ...marked(), tiles: marked().tiles.map((tile) => (tile.suit === 'moss' ? { ...tile, state: 'matched' as const } : tile)) };
        expect(turncoatNextSuit(noMoss.tiles, 'tide')).toBe('ember');
        const once = resolveOddCardTurn({ board: noMoss, turnsThisFloor: 1 });
        expect(p0(once.board).map((tile) => [tile.suit, tile.turncoat])).toEqual([['tide', 'ember'], ['tide', 'ember']]);
    });

    it('holds still while the realm has hold of it, and turns again as promised once free', () => {
        const burning = setPair(marked(), 'p0', (tile) => ({ ...tile, fuse: 3 }));
        const held = resolveOddCardTurn({ board: burning, turnsThisFloor: 1 });
        expect(held.turned).toBe(0);
        expect(p0(held.board).map((tile) => [tile.suit, tile.turncoat])).toEqual([['ember', 'tide'], ['ember', 'tide']]);
        const free = resolveOddCardTurn({ board: setPair(held.board, 'p0', ({ fuse: _fuse, ...tile }) => tile), turnsThisFloor: 2 });
        expect(p0(free.board).every((tile) => tile.suit === 'tide')).toBe(true);
    });

    it('leaves its mark behind when it goes, and is the last pair without going round in circles', () => {
        const gone = setPair(marked(), 'p0', (tile) => ({ ...tile, state: 'matched' as const }));
        expect(resolveOddCardTurn({ board: gone, turnsThisFloor: 1 }).board.tiles.some((tile) => tile.turncoat != null)).toBe(false);
        const alone: BoardState = { ...marked(), tiles: marked().tiles.map((tile) => (tile.pairKey === 'p0' ? tile : { ...tile, state: 'matched' as const })) };
        const once = resolveOddCardTurn({ board: alone, turnsThisFloor: 1 });
        // It keeps the promise it showed, then has nowhere else to turn.
        expect(p0(once.board).map((tile) => [tile.suit, tile.turncoat])).toEqual([['tide', 'tide'], ['tide', 'tide']]);
        expect(resolveOddCardTurn({ board: once.board, turnsThisFloor: 2 }).turned).toBe(0);
    });
});

describe('a turn for the Hourglass', () => {
    const marked = (sand: number): BoardState => setPair(board(), 'p1', (tile) => ({ ...tile, hourglass: sand }));
    const sandOf = (b: BoardState): Array<number | undefined> => b.tiles.filter((tile) => tile.pairKey === 'p1').map((tile) => tile.hourglass);

    it('spends a turn of sand, and pays nothing', () => {
        const turn = resolveOddCardTurn({ board: marked(3), turnsThisFloor: 1 });
        expect(sandOf(turn.board)).toEqual([2, 2]);
        expect(turn).toMatchObject({ event: null, goldDelta: 0, scoreDelta: 0 });
    });

    it('pays once when the pair goes with sand left', () => {
        const gone = setPair(marked(1), 'p1', (tile) => ({ ...tile, state: 'matched' as const }));
        const turn = resolveOddCardTurn({ board: gone, turnsThisFloor: 4 });
        expect(turn).toMatchObject({ goldDelta: HOURGLASS_GOLD, scoreDelta: HOURGLASS_SCORE, event: { key: 'hourglass:6:4', kind: 'caught', pairs: 1 } });
        expect(sandOf(turn.board)).toEqual([undefined, undefined]);
        expect(resolveOddCardTurn({ board: turn.board, turnsThisFloor: 5 })).toMatchObject({ goldDelta: 0, event: null });
    });

    it('runs out on its last turn and takes nothing but the prize', () => {
        const turn = resolveOddCardTurn({ board: marked(1), turnsThisFloor: 2 });
        expect(turn).toMatchObject({ goldDelta: 0, scoreDelta: 0, event: { kind: 'spent', pairs: 1 } });
        expect(sandOf(turn.board)).toEqual([undefined, undefined]);
        expect(turn.board.tiles.filter((tile) => tile.pairKey === 'p1').every((tile) => tile.state === 'hidden')).toBe(true);
    });

    it('leaves a board with no odd card exactly as it was', () => {
        const plain = board();
        expect(resolveOddCardTurn({ board: plain, turnsThisFloor: 1 }).board).toBe(plain);
    });
});
