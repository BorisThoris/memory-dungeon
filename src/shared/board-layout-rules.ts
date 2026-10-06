import type { RunState } from './contracts';

export const canReflowRunBoard = (run: RunState): boolean =>
    run.status === 'playing' || run.status === 'memorize' ||
    (run.status === 'paused' && run.timerState.pausedFromStatus !== 'resolving');

/** Grid cells keep their indices, cards, ground, and selection; all adjacency reads the new width. */
export const reflowRunBoard = (run: RunState, columns: number): RunState => {
    const board = run.board;
    // Finish an in-flight match against the grid it was selected on. The resize observer retries afterwards.
    if (!board || !canReflowRunBoard(run) || !Number.isInteger(columns) || columns < 1 || columns > board.tiles.length) return run;
    const rows = Math.ceil(board.tiles.length / columns);
    if (board.columns === columns && board.rows === rows) return run;
    return { ...run, board: { ...board, columns, rows } };
};
