import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
import {
    applyMagpieTheft,
    isMagpieVisitTurn,
    MAGPIE_MISS_INTERVAL,
    resolveMagpieVisit
} from './magpie-rules';

const tile = (id: string, pairKey: string, state: Tile['state']): Tile =>
    ({ id, pairKey, state, symbol: '?', label: id }) as Tile;

/** Four pairs: two cleared, two still face down. */
const board = (): BoardState =>
    ({
        level: 1,
        rows: 2,
        columns: 4,
        matchedPairs: 2,
        flippedTileIds: [],
        tiles: [
            tile('a-A', 'a', 'matched'),
            tile('c-A', 'c', 'hidden'),
            tile('a-B', 'a', 'matched'),
            tile('c-B', 'c', 'hidden'),
            tile('b-A', 'b', 'matched'),
            tile('d-A', 'd', 'hidden'),
            tile('b-B', 'b', 'matched'),
            tile('d-B', 'd', 'hidden')
        ]
    }) as unknown as BoardState;

const visit = (overrides: Partial<Parameters<typeof resolveMagpieVisit>[0]> = {}) =>
    resolveMagpieVisit({
        board: board(),
        guardTokens: 0,
        mismatchCount: MAGPIE_MISS_INTERVAL,
        rulesVersion: 1,
        runSeed: 4242,
        ...overrides
    });

describe('when the magpie turns up', () => {
    it('waits, so the first miss is a warning rather than a punishment', () => {
        expect(isMagpieVisitTurn(1)).toBe(false);
        expect(isMagpieVisitTurn(MAGPIE_MISS_INTERVAL)).toBe(true);
        expect(isMagpieVisitTurn(MAGPIE_MISS_INTERVAL * 2)).toBe(true);
        expect(isMagpieVisitTurn(0)).toBe(false);
    });

    it('does nothing on a turn that is not its own', () => {
        expect(visit({ mismatchCount: 1 })).toMatchObject({ kind: 'not_yet', theft: null });
    });

    it('turns up with nothing to take when no pair has been cleared', () => {
        const empty = { ...board(), matchedPairs: 0, tiles: board().tiles.map((t) => ({ ...t, state: 'hidden' as const })) };
        expect(visit({ board: empty })).toMatchObject({ kind: 'nothing_to_take', theft: null });
    });
});

describe('the guard token', () => {
    it('scares it off and is spent doing so', () => {
        const scared = visit({ guardTokens: 2 });
        expect(scared.kind).toBe('scared_off');
        expect(scared.guardTokens).toBe(1);
        expect(scared.theft).toBeNull();
    });

    it('protects rather than refunds: nothing is taken at all', () => {
        expect(visit({ guardTokens: 1 }).theft).toBeNull();
    });

    it('cannot be spent below zero by a malformed count', () => {
        expect(visit({ guardTokens: -5 }).guardTokens).toBe(0);
        expect(visit({ guardTokens: Number.NaN }).kind).toBe('theft');
    });
});

describe('the theft', () => {
    it('takes a pair that was already cleared', () => {
        const taken = visit();
        expect(taken.kind).toBe('theft');
        expect(['a', 'b']).toContain(taken.theft?.pairKey);
        expect(taken.theft?.tileIds).toHaveLength(2);
    });

    it('is the same bird on a replay of the same run', () => {
        expect(visit().theft?.pairKey).toBe(visit().theft?.pairKey);
        expect(visit().theft?.toIndices).toEqual(visit().theft?.toIndices);
    });

    it('is a different bird in a different run', () => {
        const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((runSeed) => visit({ runSeed }).theft?.pairKey);
        expect(new Set(seeds).size).toBeGreaterThan(1);
    });

    it('puts the pair back face down, so the score is untouched and the knowing is not', () => {
        const taken = visit();
        const after = applyMagpieTheft(board(), taken.theft!);
        const stolen = after.tiles.filter((t) => t.pairKey === taken.theft!.pairKey);
        expect(stolen).toHaveLength(2);
        expect(stolen.every((t) => t.state === 'hidden')).toBe(true);
        expect(after.matchedPairs).toBe(1);
    });

    it('moves it somewhere it was never seen, which is the whole cruelty', () => {
        const taken = visit();
        const before = board();
        const after = applyMagpieTheft(before, taken.theft!);
        const wasAt = before.tiles.map((t, i) => (t.pairKey === taken.theft!.pairKey ? i : -1)).filter((i) => i >= 0);
        const isAt = after.tiles.map((t, i) => (t.pairKey === taken.theft!.pairKey ? i : -1)).filter((i) => i >= 0);
        expect(isAt).not.toEqual(wasAt);
    });

    it('keeps every tile on the board: it moves knowledge, it does not delete cards', () => {
        const after = applyMagpieTheft(board(), visit().theft!);
        expect(after.tiles).toHaveLength(board().tiles.length);
        expect(after.tiles.map((t) => t.id).sort()).toEqual(board().tiles.map((t) => t.id).sort());
    });

    it('leaves the pair where it was when there is nowhere left to hide it', () => {
        // A board with nothing face down to swap into: the pair still comes back, in place.
        const nearlyClear = {
            ...board(),
            tiles: board().tiles.map((t) => ({ ...t, state: 'matched' as const })),
            matchedPairs: 4
        };
        const taken = resolveMagpieVisit({
            board: nearlyClear,
            guardTokens: 0,
            mismatchCount: MAGPIE_MISS_INTERVAL,
            rulesVersion: 1,
            runSeed: 4242
        });
        const after = applyMagpieTheft(nearlyClear, taken.theft!);
        expect(after.tiles.filter((t) => t.state === 'hidden')).toHaveLength(2);
        expect(after.matchedPairs).toBe(3);
    });
});
