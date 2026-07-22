import type { BoardState, RunStatus } from './contracts';

const safeBoardColumns = (board: BoardState): number =>
    typeof board.columns === 'number' && Number.isFinite(board.columns) ? Math.max(1, Math.floor(board.columns)) : 1;

const safeBoardRows = (board: BoardState, columns: number): number =>
    typeof board.rows === 'number' && Number.isFinite(board.rows)
        ? Math.max(1, Math.floor(board.rows))
        : Math.max(1, Math.ceil(board.tiles.length / columns));

/**
 * Hidden tiles to dim when focus-assist is on and exactly one tile is flipped (orthogonal neighbors + open stay bright).
 */
export const computeFocusDimmedTileIds = (
    board: BoardState | null | undefined,
    runStatus: RunStatus,
    tileFocusAssist: boolean
): ReadonlySet<string> | undefined => {
    if (!board || !tileFocusAssist || runStatus !== 'playing') {
        return undefined;
    }
    if (!Array.isArray(board.flippedTileIds) || board.flippedTileIds.length !== 1) {
        return undefined;
    }
    const openId = board.flippedTileIds[0];
    const idx = board.tiles.findIndex((t) => t.id === openId);
    if (idx < 0) {
        return undefined;
    }
    if (board.tiles[idx]?.state !== 'flipped') {
        return undefined;
    }
    const c = safeBoardColumns(board);
    const rows = safeBoardRows(board, c);
    const row = Math.floor(idx / c);
    const col = idx % c;
    const neighborIdx: number[] = [];
    if (col > 0) {
        neighborIdx.push(idx - 1);
    }
    if (col < c - 1) {
        neighborIdx.push(idx + 1);
    }
    if (row > 0) {
        neighborIdx.push(idx - c);
    }
    if (row < rows - 1) {
        neighborIdx.push(idx + c);
    }
    const keep = new Set<number>([idx, ...neighborIdx]);
    const dim = new Set<string>();
    board.tiles.forEach((t, i) => {
        if (t.state === 'hidden' && !keep.has(i)) {
            dim.add(t.id);
        }
    });
    return dim.size > 0 ? dim : undefined;
};
