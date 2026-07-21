import type { BoardState, RunState } from './contracts';
import { normalizeSessionStats } from './session-stats-rules';

export const hasFirstMismatchGrace = (run: RunState, board: BoardState): boolean => {
    const stats = normalizeSessionStats(run.stats);
    return stats.tries === 0 && (board.level === 1 || (stats.guardTokens === 0 && run.lives >= 2));
};
