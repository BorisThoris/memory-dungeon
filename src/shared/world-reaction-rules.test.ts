import { describe, expect, it } from 'vitest';
import type { BoardState, Tile, TileSuit } from './contracts';
import {
    FROST_FREE_PAIRS_KEPT,
    freePairsLeft,
    isColdWorld,
    mossOvergrowthIndex,
    resolveFrostStep,
    resolveTideSwap,
    resolveVoidSpew,
    resolveWorldShift,
    thawIfStuck,
    voidSpewPairs
} from './world-reaction-rules';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden', extra: Partial<Tile> = {}): Tile =>
    ({ id, pairKey, symbol: pairKey, label: pairKey, state, suit: 'ember' as TileSuit, ...extra }) as Tile;

/** Eight pairs, a..h, in a 4x4, halves in rows one and three / two and four. */
const board = (edit: (tiles: Tile[]) => Tile[] = (t) => t): BoardState => {
    const keys = 'abcdefgh'.split('');
    const tiles = edit([...keys.map((k) => tile(`${k}-1`, k)), ...keys.map((k) => tile(`${k}-2`, k))]);
    return { level: 4, columns: 4, rows: 4, pairCount: 8, matchedPairs: tiles.filter((t) => t.state === 'matched').length / 2, flippedTileIds: [], tiles } as unknown as BoardState;
};

const base = { runSeed: 90_210, rulesVersion: 1, pinnedTileIds: [] as string[] };

describe('the void spews', () => {
    it('spits one pair at Inferno, one more per ten links past it, three at most', () => {
        expect(voidSpewPairs(15)).toBe(0);
        expect(voidSpewPairs(16)).toBe(1);
        expect(voidSpewPairs(26)).toBe(2);
        expect(voidSpewPairs(500)).toBe(3);
    });

    it('returns matched pairs face down, without their findables, and shuffles the rest; nothing below Inferno', () => {
        const withMatched = board((tiles) => tiles.map((t) => (t.pairKey === 'a' || t.pairKey === 'b' ? { ...t, state: 'matched', findableKind: t.pairKey === 'a' ? ('score_glint' as never) : undefined } : t)));
        expect(resolveVoidSpew({ ...base, board: withMatched, comboLost: 10, mismatchCount: 1 })).toBeNull();
        const spew = resolveVoidSpew({ ...base, board: withMatched, comboLost: 26, mismatchCount: 1 })!;
        expect(spew.returnedPairKeys).toHaveLength(2);
        expect(spew.board.matchedPairs).toBe(0);
        expect(spew.board.tiles.filter((t) => t.pairKey === 'a' || t.pairKey === 'b').every((t) => t.state === 'hidden' && !t.findableKind)).toBe(true);
        expect(spew.board.tiles.map((t) => t.id)).not.toEqual(withMatched.tiles.map((t) => t.id));
        // A pinned card stays where it is.
        const pinned = resolveVoidSpew({ ...base, board: withMatched, comboLost: 26, mismatchCount: 1, pinnedTileIds: ['h-2'] })!;
        expect(pinned.board.tiles.findIndex((t) => t.id === 'h-2')).toBe(withMatched.tiles.findIndex((t) => t.id === 'h-2'));
    });
});

describe('the cold freezes', () => {
    it('is cold on a frost run or in a bone world', () => {
        expect(isColdWorld({ runSeed: 14, world: [] })).toBe(true);
        expect(isColdWorld({ runSeed: 90_210, world: [] })).toBe(false);
        expect(isColdWorld({ runSeed: 90_210, world: ['bone'] })).toBe(true);
    });

    it('freezes on every third turn, from different pairs, keeping two whole pairs free, and thaws after two turns', () => {
        const step = (turnsThisFloor: number, b: BoardState, frozenUntilTurn: number | null = null) =>
            resolveFrostStep({ ...base, board: b, turnsThisFloor, frozenUntilTurn, cold: true, combo: 0 });
        expect(step(2, board()).froze).toBe(false);
        const froze = step(3, board());
        expect(froze.froze).toBe(true);
        expect(froze.frozenUntilTurn).toBe(5);
        const frozen = froze.board.tiles.filter((t) => t.frozen);
        expect(frozen).toHaveLength(2);
        expect(freePairsLeft(froze.board)).toBeGreaterThanOrEqual(FROST_FREE_PAIRS_KEPT);
        expect(step(4, froze.board, froze.frozenUntilTurn).board.tiles.filter((t) => t.frozen)).toHaveLength(2);
        expect(step(5, froze.board, froze.frozenUntilTurn).board.tiles.some((t) => t.frozen)).toBe(false);
        // Not cold, never.
        expect(resolveFrostStep({ ...base, board: board(), turnsThisFloor: 3, frozenUntilTurn: null, cold: false, combo: 0 }).froze).toBe(false);
    });

    it('over many seeds, freezes both halves of a pair only sometimes, so the ice is no hint', () => {
        let pairs = 0;
        let singles = 0;
        for (let seed = 1; seed <= 200; seed += 1) {
            const step = resolveFrostStep({ ...base, runSeed: seed, board: board(), turnsThisFloor: 3, frozenUntilTurn: null, cold: true, combo: 0 });
            const keys = step.board.tiles.filter((t) => t.frozen).map((t) => t.pairKey);
            if (new Set(keys).size < keys.length) pairs += 1;
            else singles += 1;
        }
        expect(pairs).toBeGreaterThan(20);
        expect(singles).toBeGreaterThan(pairs);
    });

    it('never freezes a board too small to keep two pairs free, and cracks when a pop leaves none', () => {
        const small = board((tiles) => tiles.map((t) => ('abcdef'.includes(t.pairKey) ? { ...t, state: 'matched' } : t)));
        expect(resolveFrostStep({ ...base, board: small, turnsThisFloor: 3, frozenUntilTurn: null, cold: true, combo: 0 }).froze).toBe(false);
        const stuck = board((tiles) => tiles.map((t) => ('abcdef'.includes(t.pairKey) ? { ...t, state: 'matched' } : t.id.endsWith('-1') ? { ...t, frozen: true } : t)));
        expect(freePairsLeft(stuck)).toBe(0);
        expect(thawIfStuck(stuck).tiles.some((t) => t.frozen)).toBe(false);
    });
});

describe('element worlds', () => {
    it('shift on a pop of three pairs, combine two elements, and drop the oldest', () => {
        expect(resolveWorldShift([], 'tide', 2)).toEqual([]);
        expect(resolveWorldShift([], 'tide', 3)).toEqual(['tide']);
        expect(resolveWorldShift(['tide'], 'moss', 4)).toEqual(['tide', 'moss']);
        expect(resolveWorldShift(['tide', 'moss'], 'bone', 3)).toEqual(['moss', 'bone']);
        expect(resolveWorldShift(['tide', 'moss'], 'tide', 3)).toEqual(['moss', 'tide']);
        expect(resolveWorldShift(undefined, undefined, 9)).toEqual([]);
    });

    it('tide trades two cards of different pairs on its turn, never a pinned or frozen one', () => {
        expect(resolveTideSwap({ ...base, board: board(), turnsThisFloor: 3 })).toBeNull();
        const swapped = resolveTideSwap({ ...base, board: board(), turnsThisFloor: 4 })!;
        const moved = swapped.tiles.filter((t, index) => board().tiles[index]!.id !== t.id);
        expect(moved).toHaveLength(2);
        expect(moved[0]!.pairKey).not.toBe(moved[1]!.pairKey);
    });

    it('moss overgrows the first face-down card beside the match', () => {
        const b = board((tiles) => tiles.map((t) => (t.id === 'a-1' || t.id === 'a-2' ? { ...t, state: 'matched' } : t)));
        expect(mossOvergrowthIndex(b, 'a-1')).toBe(1);
    });
});
