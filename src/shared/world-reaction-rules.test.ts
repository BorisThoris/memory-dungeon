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
    resolveWorldPull,
    advanceElementStreak,
    worldFusion,
    worldRules,
    FROST_FREEZE_MAX,
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
    it('is cold only in a bone world: no run is born cold', () => {
        expect(isColdWorld({ world: [] })).toBe(false);
        expect(isColdWorld({ world: ['tide'] })).toBe(false);
        expect(isColdWorld({ world: ['bone'] })).toBe(true);
        expect(isColdWorld({ world: ['bone', 'moss'] })).toBe(true);
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
    it('a pull enters an element, deepens the one the world holds, and is held off by a deep world', () => {
        expect(resolveWorldPull([], 0, 'tide')).toEqual({ world: ['tide'], depth: 1, outcome: 'entered' });
        expect(resolveWorldPull(['tide'], 1, 'tide')).toEqual({ world: ['tide'], depth: 2, outcome: 'deepened' });
        expect(resolveWorldPull(['tide'], 3, 'tide')).toEqual({ world: ['tide'], depth: 3, outcome: 'deepened' });
        // A deep world wears down before it lets another element in.
        expect(resolveWorldPull(['tide'], 2, 'moss')).toEqual({ world: ['tide'], depth: 1, outcome: 'held' });
        expect(resolveWorldPull(['tide'], 1, 'moss')).toEqual({ world: ['tide', 'moss'], depth: 1, outcome: 'entered' });
        // Two at most: a third element pushes the oldest out; a held element leads again.
        expect(resolveWorldPull(['tide', 'moss'], 1, 'bone')).toEqual({ world: ['moss', 'bone'], depth: 1, outcome: 'entered' });
        expect(resolveWorldPull(['tide', 'moss'], 1, 'tide')).toEqual({ world: ['moss', 'tide'], depth: 2, outcome: 'deepened' });
        expect(resolveWorldPull(undefined, undefined, undefined)).toEqual({ world: [], depth: 0, outcome: null });
    });

    it('three matches of one element in a row pull the world, and a different element starts the count again', () => {
        let step = advanceElementStreak(null, 'moss');
        expect(step).toEqual({ streak: { suit: 'moss', count: 1 }, pulls: false });
        step = advanceElementStreak(step.streak, 'moss');
        expect(step.pulls).toBe(false);
        step = advanceElementStreak(step.streak, 'moss');
        expect(step).toEqual({ streak: null, pulls: true });
        expect(advanceElementStreak({ suit: 'moss', count: 2 }, 'bone')).toEqual({ streak: { suit: 'bone', count: 1 }, pulls: false });
        expect(advanceElementStreak({ suit: 'moss', count: 2 }, undefined)).toEqual({ streak: null, pulls: false });
    });

    it('two elements fuse into a named world, whatever their order', () => {
        expect(worldFusion(['tide', 'bone'])?.id).toBe('blizzard');
        expect(worldFusion(['bone', 'tide'])?.id).toBe('blizzard');
        expect(worldFusion(['ember', 'tide'])?.id).toBe('steam');
        expect(worldFusion(['moss', 'ember'])?.id).toBe('wildfire');
        expect(worldFusion(['bone', 'ember'])?.id).toBe('ash');
        expect(worldFusion(['tide', 'moss'])?.id).toBe('swamp');
        expect(worldFusion(['moss', 'bone'])?.id).toBe('grave');
        expect(worldFusion(['tide'])).toBeNull();
    });

    it('turns each world into its rules, sharper deep and sharper fused, inside the guards', () => {
        expect(worldRules([], 0)).toMatchObject({ afterglowBonus: 0, tideEvery: null, cold: false, overgrowth: false, fusion: null });
        expect(worldRules(['ember'], 1).afterglowBonus).toBe(1);
        expect(worldRules(['ember'], 3).afterglowBonus).toBe(2);
        expect(worldRules(['tide'], 1)).toMatchObject({ tideEvery: 3, tideSwaps: 1 });
        expect(worldRules(['tide'], 3).tideSwaps).toBe(2);
        expect(worldRules(['bone'], 1)).toMatchObject({ cold: true, freezeTurns: 2, freezeExtra: 0 });
        expect(worldRules(['bone'], 3).freezeTurns).toBe(3);
        expect(worldRules(['tide', 'bone'], 1)).toMatchObject({ cold: true, freezeExtra: 1, freezeTurns: 3, tideEvery: 3 });
        expect(worldRules(['ember', 'tide'], 1).tideEvery).toBe(2);
        expect(worldRules(['ember', 'bone'], 1)).toMatchObject({ cold: true, freezeExtra: -1, afterglowBonus: 1 });
        expect(worldRules(['moss', 'ember'], 1).afterglowBonus).toBe(2);
        expect(worldRules(['tide', 'moss'], 1)).toMatchObject({ tideSwaps: 2, overgrowth: true });
        expect(worldRules(['moss', 'bone'], 1)).toMatchObject({ freezeTurns: 3, overgrowth: true });
    });

    it('a blizzard freezes more and for longer, and still leaves two whole pairs free', () => {
        const rules = worldRules(['tide', 'bone'], 1);
        const step = resolveFrostStep({ ...base, board: board(), turnsThisFloor: 3, frozenUntilTurn: null, cold: rules.cold, combo: 0, freezeExtra: rules.freezeExtra, freezeTurns: rules.freezeTurns });
        expect(step.board.tiles.filter((t) => t.frozen)).toHaveLength(3);
        expect(step.frozenUntilTurn).toBe(6);
        expect(freePairsLeft(step.board)).toBeGreaterThanOrEqual(FROST_FREE_PAIRS_KEPT);
        const hot = resolveFrostStep({ ...base, board: board(), turnsThisFloor: 3, frozenUntilTurn: null, cold: true, combo: 30, freezeExtra: 5 });
        expect(hot.board.tiles.filter((t) => t.frozen).length).toBeLessThanOrEqual(FROST_FREEZE_MAX);
    });

    it('tide trades two cards of different pairs on its turn, never a pinned or frozen one', () => {
        expect(resolveTideSwap({ ...base, board: board(), turnsThisFloor: 3 })).toBeNull();
        // Steam runs every second turn, a swamp trades two pairs of cards.
        expect(resolveTideSwap({ ...base, board: board(), turnsThisFloor: 3, every: 2 })).not.toBeNull();
        const swamp = resolveTideSwap({ ...base, board: board(), turnsThisFloor: 4, swaps: 2 })!;
        expect(swamp.tiles.filter((t, index) => board().tiles[index]!.id !== t.id)).toHaveLength(4);
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
