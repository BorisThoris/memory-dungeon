import type { BoardState } from './contracts';
import { runNonNegativeIntegerWithFallback } from './run-number-guards';

export const getSafeBoardColumns = (board: Pick<BoardState, 'columns'>): number =>
    Math.max(1, runNonNegativeIntegerWithFallback(board.columns, 1));

export const getSafeBoardRows = (board: Pick<BoardState, 'rows' | 'tiles'>, columns: number): number =>
    Math.max(1, runNonNegativeIntegerWithFallback(board.rows, Math.ceil(board.tiles.length / columns)));
