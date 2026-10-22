import type { BoardState, RunState, Tile } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The Cartographer (DGE-018, rules 82): the Deep's boss, floor 40.
 *
 * The Deep's idea is Layers (`board-layers-rules.ts`): a second deck under two cells in five. The
 * Cartographer's floor is dealt two decks deep, and for the study window the lower deck is charted:
 * each waiting card's edge shows its element (`player-visible-board.ts`). Then, every third match,
 * the lower deck turns a quarter: each ring of cells, outside in, carries its waiting cards a quarter
 * of the way round, clockwise. On a square board that is a quarter turn exactly; on any other it is
 * the same turn with wrap, a ring of any shape (the ticket's "bounding square with wrap") and always a
 * bijection, so no card is lost or doubled. A cell whose top card is pinned keeps what lies under it,
 * and the ring turns round it. The top deck never moves.
 */
export const CARTOGRAPHER_RULES_FROM = 82;
export const CARTOGRAPHER_TURN_EVERY_MATCHES = 3;

export const isCartographerFloor = (board: Pick<BoardState, 'floorArchetypeId'> | null | undefined): boolean =>
    board?.floorArchetypeId === 'cartographer_hall';

/** The board's rings, outside in, each clockwise from its top-left cell. */
export const boardRings = (columns: number, rows: number, total: number): number[][] => {
    const rings: number[][] = [];
    const cols = Math.max(1, Math.floor(columns));
    const height = Math.max(1, Math.ceil(total / cols));
    const usable = Math.min(rows, height);
    for (let k = 0; k * 2 < Math.min(cols, usable); k += 1) {
        const top = k;
        const left = k;
        const bottom = usable - 1 - k;
        const right = cols - 1 - k;
        const ring: number[] = [];
        for (let c = left; c <= right; c += 1) ring.push(top * cols + c);
        for (let r = top + 1; r <= bottom; r += 1) ring.push(r * cols + right);
        if (bottom > top) for (let c = right - 1; c >= left; c -= 1) ring.push(bottom * cols + c);
        if (right > left) for (let r = bottom - 1; r > top; r -= 1) ring.push(r * cols + left);
        rings.push(ring.filter((cell) => cell < total));
    }
    return rings;
};

/** The lower deck turned a quarter, ring by ring; cells under a pinned card hold. */
export const rotateLowerLayer = (board: BoardState, pinnedTileIds: readonly string[]): BoardState => {
    if (!board.beneath) return board;
    const pinned = new Set(pinnedTileIds);
    const beneath: (Tile | null)[] = [...board.beneath];
    for (const ring of boardRings(board.columns, board.rows, board.tiles.length)) {
        const cells = ring.filter((cell) => !pinned.has(board.tiles[cell]?.id ?? ''));
        const step = Math.floor(cells.length / 4);
        if (step === 0) continue;
        const cards = cells.map((cell) => board.beneath![cell] ?? null);
        cells.forEach((cell, index) => {
            beneath[cell] = cards[(index - step + cells.length) % cells.length] ?? null;
        });
    }
    return { ...board, beneath };
};

/** Applied after every resolved turn: on every third match of the floor, the lower deck turns. */
export const applyCartographerTurn = (before: RunState, after: RunState): RunState => {
    if ((after.runRulesVersion ?? 0) < CARTOGRAPHER_RULES_FROM || after.status !== 'playing' || !after.board || !isCartographerFloor(after.board)) return after;
    const matches = runNonNegativeInteger(after.matchResolutionsThisFloor);
    if (matches === runNonNegativeInteger(before.matchResolutionsThisFloor) || matches % CARTOGRAPHER_TURN_EVERY_MATCHES !== 0) return after;
    return {
        ...after,
        board: rotateLowerLayer(after.board, after.pinnedTileIds ?? []),
        cartographerTurnsThisFloor: runNonNegativeInteger(after.cartographerTurnsThisFloor) + 1
    };
};
