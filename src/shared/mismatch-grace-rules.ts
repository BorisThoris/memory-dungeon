import type { BoardState, RunState } from './contracts';

export const hasFirstMismatchGrace = (run: RunState, board: BoardState): boolean =>
    run.stats.tries === 0 && (board.level === 1 || (run.stats.guardTokens === 0 && run.lives >= 2));
