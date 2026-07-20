import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchBoardCleanup } from './turn-match-board-cleanup-rules';

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
            firstMatchedTileId: first.id,
            recallBonus: 7
        });

        expect(result.pinnedTileIds).toEqual([third.id]);
        expect(result.recallFocus).toBe(2);
        expect(result.recallMatchesThisFloor).toBe(3);
        expect(result.recallBonusScoreThisFloor).toBe(22);
        expect(result.forgottenTileIdsThisFloor).toEqual([third.id]);
        expect(result.stickyBlockIndex).toBeNull();
    });

    it('returns the first matched tile index for sticky fingers', () => {
        const base = createNewRun(0, { activeMutators: ['sticky_fingers'] });
        const [first, second] = base.board!.tiles;

        const result = resolveTurnMatchBoardCleanup({
            run: base,
            board: base.board!,
            matchedTileIds: [second.id, first.id],
            firstMatchedTileId: second.id,
            recallBonus: 0
        });

        expect(result.stickyBlockIndex).toBe(1);
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
            firstMatchedTileId: first.id,
            recallBonus: Number.POSITIVE_INFINITY
        });

        expect(result.recallMatchesThisFloor).toBe(1);
        expect(result.recallBonusScoreThisFloor).toBe(2);
    });
});
