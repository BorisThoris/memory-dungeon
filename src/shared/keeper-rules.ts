import { DEPTH_KEEPER_SWAP_EVERY, depthHas } from './depth-rules';
import type { BoardState, RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The Keeper of Halls (DGE-011, rules 81): the Living Dungeon's boss, floor 24.
 *
 * The act's idea is the Fold (`board-fold-rules.ts`), two rooms and a doorway, so its boss is a Fold
 * whose rooms will not stay put: every fourth resolved turn the two rooms swap sides, each card
 * keeping its place inside its room. What the player knows stays true, a room's width over. Pinned
 * cards hold their cells, and so do the cells across from them, so a pin is a fixed point the swap
 * goes round. The swap comes first on its turn, before the Wanderers step (`board-turn-transition.ts`).
 */
export const KEEPER_RULES_FROM = 81;
export const KEEPER_SWAP_EVERY_TURNS = 4;

export const isKeeperFloor = (board: Pick<BoardState, 'floorArchetypeId'> | null | undefined): boolean => board?.floorArchetypeId === 'keeper_hall';

/** The cell pairs the swap trades: each left-room cell with the one a room's width to its right. */
export const keeperSwapCells = (board: Pick<BoardState, 'columns' | 'rows' | 'fold' | 'tiles'>): [number, number][] => {
    if (!board.fold) return [];
    const columns = Math.max(1, Math.floor(board.columns));
    const width = board.fold.afterColumn + 1;
    const out: [number, number][] = [];
    for (let row = 0; row * columns < board.tiles.length; row += 1) {
        for (let col = 0; col < width; col += 1) {
            const a = row * columns + col;
            const b = row * columns + width + col;
            if (width + col < columns && b < board.tiles.length) out.push([a, b]);
        }
    }
    return out;
};

/** The rooms swapped: every cell trades with its counterpart, unless either holds a pinned card. */
export const swapRooms = (board: BoardState, pinnedTileIds: readonly string[]): BoardState => {
    const pinned = new Set(pinnedTileIds);
    const tiles = [...board.tiles];
    const beneath = board.beneath ? [...board.beneath] : undefined;
    for (const [a, b] of keeperSwapCells(board)) {
        if (pinned.has(tiles[a]!.id) || pinned.has(tiles[b]!.id)) continue;
        [tiles[a], tiles[b]] = [tiles[b]!, tiles[a]!];
        if (beneath) [beneath[a], beneath[b]] = [beneath[b] ?? null, beneath[a] ?? null];
    }
    return { ...board, tiles, ...(beneath ? { beneath } : {}) };
};

/** Whether this many turns into the floor is a swap turn. */
/** The Keeper's clock for this run: Depth 8 (`depth-rules.ts`) winds it to three. */
export const keeperSwapEvery = (run: Pick<RunState, 'depth'> | null | undefined): number => (depthHas(run, 'keeper_fast') ? DEPTH_KEEPER_SWAP_EVERY : KEEPER_SWAP_EVERY_TURNS);

export const isKeeperSwapTurn = (turnsThisFloor: number, every = KEEPER_SWAP_EVERY_TURNS): boolean =>
    turnsThisFloor > 0 && turnsThisFloor % every === 0;

/** Applied after every resolved turn, before the Wanderers: on the fourth, the rooms swap. */
export const applyKeeperTurn = (before: RunState, after: RunState): RunState => {
    if ((after.runRulesVersion ?? 0) < KEEPER_RULES_FROM || after.status !== 'playing' || !after.board || !isKeeperFloor(after.board)) return after;
    const turns = runNonNegativeInteger(after.turnsThisFloor);
    if (turns === runNonNegativeInteger(before.turnsThisFloor) || !isKeeperSwapTurn(turns, keeperSwapEvery(after))) return after;
    return {
        ...after,
        board: swapRooms(after.board, after.pinnedTileIds ?? []),
        keeperSwapsThisFloor: runNonNegativeInteger(after.keeperSwapsThisFloor) + 1
    };
};
