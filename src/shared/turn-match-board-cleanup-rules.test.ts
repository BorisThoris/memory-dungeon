import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import type { BoardState, Tile } from './contracts';
import { resolveTurnMatchBoardCleanup, selectStickyFingersLockIndex } from './turn-match-board-cleanup-rules';

describe('resolveTurnMatchBoardCleanup', () => {
    it('removes matched pins and advances recall ledgers', () => {
        const base = createNewRun(0);
        const [first, second, third] = base.board!.tiles;
        const run = {
            ...base,
            pinnedTileIds: [first.id, third.id],
            recallFocus: 1,
            recallMatchesThisFloor: 2,
            recallBonusScoreThisFloor: 15,
            forgottenTileIdsThisFloor: [first.id, third.id]
        };

        const result = resolveTurnMatchBoardCleanup({
            run,
            board: base.board!,
            matchedTileIds: [first.id, second.id],
            recallBonus: 7
        });

        expect(result.pinnedTileIds).toEqual([third.id]);
        expect(result.recallFocus).toBe(2);
        expect(result.recallMatchesThisFloor).toBe(3);
        expect(result.recallBonusScoreThisFloor).toBe(22);
        expect(result.forgottenTileIdsThisFloor).toEqual([third.id]);
    });

    it('normalizes malformed recall cleanup counters before advancing ledgers', () => {
        const base = createNewRun(0);
        const [first, second] = base.board!.tiles;
        const run = {
            ...base,
            recallMatchesThisFloor: Number.NaN,
            recallBonusScoreThisFloor: 2.9
        };

        const result = resolveTurnMatchBoardCleanup({
            run,
            board: base.board!,
            matchedTileIds: [first.id, second.id],
            recallBonus: Number.POSITIVE_INFINITY
        });

        expect(result.recallMatchesThisFloor).toBe(1);
        expect(result.recallBonusScoreThisFloor).toBe(2);
    });
});

describe('selectStickyFingersLockIndex', () => {
    /** A 3x3 board: pairs a, b, c, d and one spare, states given in board order. */
    const grid = (states: Tile['state'][], keys = ['a', 'b', 'a', 'c', 'b', 'c', 'd', 'x', 'd']): Pick<BoardState, 'columns' | 'tiles'> => ({
        columns: 3,
        tiles: keys.map((pairKey, index) => ({ id: `t${index}`, pairKey, state: states[index] ?? 'hidden' }) as Tile)
    });

    it('locks a face-down card touching the match, never the matched card itself', () => {
        // Played to floor 7, the old lock sat on the first matched card: a card nobody can open.
        const board = grid(['matched', 'hidden', 'matched', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
        const lock = selectStickyFingersLockIndex(board, ['t0', 't2']);
        expect(lock).toBe(1);
        expect(board.tiles[lock!]!.state).toBe('hidden');
    });

    it('locks nothing when no face-down card touches the match', () => {
        // Five wide: the a pair in the top-left corner, every card touching it already matched.
        const board = {
            ...grid(
                ['matched', 'matched', 'matched', 'hidden', 'hidden', 'matched', 'matched', 'matched', 'hidden', 'hidden'],
                ['a', 'a', 'e', 'b', 'c', 'f', 'f', 'e', 'c', 'b']
            ),
            columns: 5
        };
        expect(selectStickyFingersLockIndex(board, ['t0', 't1'])).toBeNull();
    });

    it('never locks when only one hidden pair is left to open with', () => {
        const board = grid(['matched', 'matched', 'matched', 'matched', 'matched', 'matched', 'hidden', 'matched', 'hidden']);
        expect(selectStickyFingersLockIndex(board, ['t3', 't5'])).toBeNull();
    });
});
