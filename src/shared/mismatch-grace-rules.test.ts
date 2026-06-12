import { describe, expect, it } from 'vitest';
import type { BoardState, RunState } from './contracts';
import { createNewRun } from './game-core';
import { hasFirstMismatchGrace } from './mismatch-grace-rules';

const withRun = (overrides: Partial<RunState> = {}, boardOverrides: Partial<BoardState> = {}) => {
    const run = createNewRun(0);
    const board = {
        ...run.board!,
        ...boardOverrides
    };
    return {
        board,
        run: {
            ...run,
            ...overrides,
            board
        }
    };
};

describe('mismatch-grace-rules', () => {
    it('grants first mismatch grace on level one', () => {
        const { board, run } = withRun({ lives: 1 }, { level: 1 });

        expect(hasFirstMismatchGrace(run, board)).toBe(true);
    });

    it('grants first mismatch grace later when no guard tokens and at least two lives remain', () => {
        const { board, run } = withRun(
            {
                lives: 2,
                stats: {
                    ...createNewRun(0).stats,
                    guardTokens: 0,
                    tries: 0
                }
            },
            { level: 3 }
        );

        expect(hasFirstMismatchGrace(run, board)).toBe(true);
    });

    it('does not grant grace after a prior try, with guard tokens, or at one life after level one', () => {
        const baseStats = createNewRun(0).stats;
        const priorTry = withRun({ stats: { ...baseStats, tries: 1 } }, { level: 1 });
        const guarded = withRun({ lives: 3, stats: { ...baseStats, guardTokens: 1 } }, { level: 3 });
        const lastLife = withRun({ lives: 1, stats: { ...baseStats, guardTokens: 0 } }, { level: 3 });

        expect(hasFirstMismatchGrace(priorTry.run, priorTry.board)).toBe(false);
        expect(hasFirstMismatchGrace(guarded.run, guarded.board)).toBe(false);
        expect(hasFirstMismatchGrace(lastLife.run, lastLife.board)).toBe(false);
    });
});
