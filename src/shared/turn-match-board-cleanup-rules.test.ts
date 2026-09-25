import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchBoardCleanup, selectStickyFingersBlockIndex } from './turn-match-board-cleanup-rules';

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
            matchedTileIds: [first.id, second.id],
            recallBonus: Number.POSITIVE_INFINITY
        });

        expect(result.recallMatchesThisFloor).toBe(1);
        expect(result.recallBonusScoreThisFloor).toBe(2);
    });
});

describe('selectStickyFingersBlockIndex', () => {
    /*
     * Regression: sticky fingers used to block the slot of the first matched card, which is matched
     * and so could never be opened anyway - the block refused nothing. It must land on a face-down
     * card touching the match.
     */
    const run = createNewRun(0, { activeMutators: ['sticky_fingers'] });
    const board = run.board!;
    const columns = board.columns;
    const matchedAt = columns + 1; // an inner cell, so it has four neighbours
    const matchedBoard = {
        ...board,
        tiles: board.tiles.map((tile, index) => (index === matchedAt ? { ...tile, state: 'matched' as const } : tile))
    };
    const matchedId = matchedBoard.tiles[matchedAt]!.id;

    it('blocks a face-down neighbour of the first matched card, never the matched card', () => {
        const blocked = selectStickyFingersBlockIndex(run, matchedBoard, matchedId);
        expect(blocked).toBe(matchedAt - columns);
        expect(matchedBoard.tiles[blocked!]!.state).toBe('hidden');
    });

    it('skips neighbours that are no longer face down', () => {
        const above = matchedAt - columns;
        const withAboveGone = {
            ...matchedBoard,
            tiles: matchedBoard.tiles.map((tile, index) => (index === above ? { ...tile, state: 'matched' as const } : tile))
        };
        expect(selectStickyFingersBlockIndex(run, withAboveGone, matchedId)).toBe(matchedAt - 1);
    });

    it('blocks nothing without the mutator', () => {
        expect(selectStickyFingersBlockIndex({ ...run, activeMutators: [] }, matchedBoard, matchedId)).toBeNull();
    });
});
