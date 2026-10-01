import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import { resolveVoidSpew, voidSpewPairs } from './void-spew-rules';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden', extra: Partial<Tile> = {}): Tile =>
    ({ id, pairKey, symbol: pairKey.toUpperCase(), label: pairKey, state, suit: 'ember', ...extra }) as Tile;

const board = (gone: readonly string[]): BoardState => {
    const keys = 'abcdefgh'.split('');
    const tiles = [...keys.map((k) => tile(`${k}-1`, k, gone.includes(k) ? 'matched' : 'hidden')), ...keys.map((k) => tile(`${k}-2`, k, gone.includes(k) ? 'matched' : 'hidden'))];
    return { level: 4, columns: 4, rows: 4, pairCount: 8, matchedPairs: gone.length, flippedTileIds: [], tiles } as unknown as BoardState;
};

const base = { runSeed: 90_210, rulesVersion: 52, mismatchCount: 3 };

describe('the void spews', () => {
    it('spits one pair at Inferno, one more per ten links past it, three at most', () => {
        expect(voidSpewPairs(15)).toBe(0);
        expect(voidSpewPairs(16)).toBe(1);
        expect(voidSpewPairs(26)).toBe(2);
        expect(voidSpewPairs(500)).toBe(3);
    });

    it('does nothing below Inferno, or with no cleared cell to spit into', () => {
        expect(resolveVoidSpew({ ...base, board: board(['a', 'b']), comboLost: 10 })).toBeNull();
        expect(resolveVoidSpew({ ...base, board: board([]), comboLost: 30 })).toBeNull();
    });

    it('lays brand-new pairs, face down with faces the board has not shown, into cleared cells', () => {
        const before = board(['a', 'b', 'c']);
        const spew = resolveVoidSpew({ ...base, board: before, comboLost: 26 })!;
        expect(spew.newPairKeys).toHaveLength(2);
        const fresh = spew.board.tiles.filter((t) => spew.newPairKeys.includes(t.pairKey));
        expect(fresh).toHaveLength(4);
        expect(fresh.every((t) => t.state === 'hidden')).toBe(true);
        const shown = new Set(before.tiles.map((t) => t.symbol));
        expect(fresh.some((t) => shown.has(t.symbol))).toBe(false);
        // Each new pair is a pair: two halves, one face.
        for (const key of spew.newPairKeys) {
            const halves = fresh.filter((t) => t.pairKey === key);
            expect(halves).toHaveLength(2);
            expect(halves[0]!.symbol).toBe(halves[1]!.symbol);
        }
        // matchedPairs still counts exactly the pairs gone from the board.
        const gone = new Set(spew.board.tiles.filter((t) => t.state === 'matched').map((t) => t.pairKey)).size;
        expect(spew.board.matchedPairs).toBe(gone);
        expect(spew.board.tiles).toHaveLength(before.tiles.length);
    });

    it('reshuffles every face-down card, and the same miss spits the same way', () => {
        const before = board(['a']);
        const spew = resolveVoidSpew({ ...base, board: before, comboLost: 16 })!;
        const moved = spew.board.tiles.filter((t, index) => t.state === 'hidden' && before.tiles[index]!.id !== t.id).length;
        expect(moved).toBeGreaterThan(8);
        expect(resolveVoidSpew({ ...base, board: before, comboLost: 16 })).toEqual(spew);
        // Nothing face up or gone moves.
        spew.board.tiles.forEach((t, index) => {
            if (t.state === 'matched') expect(before.tiles[index]!.state).toBe('matched');
        });
    });
});
