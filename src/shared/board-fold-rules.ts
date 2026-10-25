import type { BoardState, TileSuit } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';
import { contentFloor } from './descent-length-rules';

/**
 * The Fold (DGE-010): a board that is two rooms side by side, a wall between them and a doorway
 * through it.
 *
 * The board stays one rectangular grid - every index is still `row * columns + col`, every pair still
 * two cards - and the wall is a cut in its adjacency: between column `afterColumn` and the one after
 * it, no two cards touch, except on the `doorRows`, where the doorway is open. Every rule that walks
 * from a card to its neighbours asks `foldCutsEdge` (through the shared neighbour helpers), so the
 * lantern, the skittish flinch, the realm's spread, the deal and the Wanderers all stop at the wall
 * and pass through the door.
 *
 * The pop is the one walker that may find the door shut: a cascade crosses it only when the match
 * that set it off stood in a door cell, the card on either side of the doorway (`foldDoorOpenFor`).
 * Where you match decides what else leaves.
 *
 * A diagonal never crosses the wall, door or not: the doorway is an opening, not a corner.
 */
export interface BoardFold {
    /** The wall runs between this column and the next. */
    readonly afterColumn: number;
    /** The rows where the wall is open. */
    readonly doorRows: readonly number[];
}

/** True when the wall stands between cells `a` and `b` (neighbours on a `columns`-wide grid). */
export const foldCutsEdge = (a: number, b: number, columns: number, fold: BoardFold | null | undefined, crossDoors = true): boolean => {
    if (!fold) return false;
    const cols = Math.max(1, Math.floor(columns));
    const [colA, colB] = [a % cols, b % cols];
    const straddles = Math.min(colA, colB) <= fold.afterColumn && Math.max(colA, colB) > fold.afterColumn;
    if (!straddles) return false;
    const [rowA, rowB] = [Math.floor(a / cols), Math.floor(b / cols)];
    // A diagonal crossing the wall is a corner, never the doorway.
    if (rowA !== rowB) return true;
    return !(crossDoors && fold.doorRows.includes(rowA));
};

/** The cells either side of the doorway: a match in one of them opens the door to the pop. */
export const foldDoorCells = (board: Pick<BoardState, 'columns' | 'fold'>): number[] => {
    const fold = board.fold;
    if (!fold) return [];
    const cols = Math.max(1, Math.floor(board.columns));
    return fold.doorRows.flatMap((row) => [row * cols + fold.afterColumn, row * cols + fold.afterColumn + 1]);
};

/** Whether a break seeded on these cells may cross the doorway. */
export const foldDoorOpenFor = (board: Pick<BoardState, 'columns' | 'fold'>, seedIndices: readonly number[]): boolean => {
    if (!board.fold) return true;
    const doors = new Set(foldDoorCells(board));
    return seedIndices.some((index) => doors.has(index));
};

/** Which room a cell is in: 0 left of the wall, 1 right of it. */
export const foldRoomOf = (board: Pick<BoardState, 'columns' | 'fold'>, index: number): 0 | 1 =>
    board.fold && index % Math.max(1, Math.floor(board.columns)) > board.fold.afterColumn ? 1 : 0;

export const FOLD_RULES_FROM = 71;
export const FOLD_FROM_FLOOR = 13;
/** The cycle floors that fold, from the Living Dungeon on: the fourth and the eleventh of every twelve. */
export const FOLD_CYCLE_FLOORS: readonly number[] = [4, 11];
/** Of the cards dealt into the room that does not want them, how many trade into the room that does. */
export const FOLD_SUIT_LEAN = 0.7;

/** Whether a floor is dealt as the Fold: from floor 13, on its cycle floors, never on a boss floor. */
export const isFoldFloor = (board: Pick<BoardState, 'level' | 'descentFloor' | 'floorTag' | 'cycleFloor' | 'columns' | 'rows' | 'floorArchetypeId'>, rulesVersion: number): boolean =>
    // The Keeper of Halls (`keeper-rules.ts`) is a Fold on its boss floor (rules 81).
    (rulesVersion >= 81 && board.floorArchetypeId === 'keeper_hall' && board.columns >= 4 && board.rows >= 2) ||
    (rulesVersion >= FOLD_RULES_FROM &&
    contentFloor(board) >= FOLD_FROM_FLOOR &&
    board.floorTag !== 'boss' &&
    board.cycleFloor != null &&
    FOLD_CYCLE_FLOORS.includes(board.cycleFloor) &&
    board.columns >= 4 &&
    board.rows >= 2);

/** The wall down the middle, the doorway on the middle rows: two rows of it on a board three rows tall or more. */
export const foldFor = (columns: number, rows: number): BoardFold => {
    const afterColumn = Math.floor(columns / 2) - 1;
    const middle = Math.floor(rows / 2);
    return { afterColumn, doorRows: rows >= 3 ? [middle - 1, middle] : [middle] };
};

/**
 * Deals the Fold onto a built board: the wall, and a lean - each room is given two of the floor's
 * elements, and most cards dealt into the room that does not want them trade places with a card the
 * other room does not want. Cards keep their faces and pairs; only their cells change, so the deal's
 * spacing mostly stands. From the run's seed.
 */
export const foldBoard = (board: BoardState, { runSeed, rulesVersion }: { runSeed: number; rulesVersion: number }): BoardState => {
    if (!isFoldFloor(board, rulesVersion)) return board;
    const fold = foldFor(board.columns, board.rows);
    const folded: BoardState = { ...board, fold };
    const counts = new Map<TileSuit, number>();
    for (const tile of board.tiles) if (tile.suit && !isSingletonUtilityPairKey(tile.pairKey)) counts.set(tile.suit, (counts.get(tile.suit) ?? 0) + 1);
    const suits = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([suit]) => suit);
    if (suits.length < 2) return folded;
    // Alternate by size so the rooms weigh the same: the first and third largest left, the second and fourth right.
    const wants = new Map<TileSuit, 0 | 1>(suits.map((suit, index) => [suit, (index % 2) as 0 | 1]));
    const misplaced = (room: 0 | 1): number[] =>
        board.tiles.flatMap((tile, index) =>
            tile.state === 'hidden' && tile.suit && !isSingletonUtilityPairKey(tile.pairKey) && foldRoomOf(folded, index) === room && wants.get(tile.suit) !== room ? [index] : []
        );
    const rng = createMulberry32(hashStringToSeed(`fold:${runSeed}:${rulesVersion}:${board.level}`));
    const shuffled = (cells: number[]): number[] => {
        const out = [...cells];
        for (let i = out.length - 1; i > 0; i -= 1) {
            const j = pickRngIndex(rng, i + 1);
            [out[i], out[j]] = [out[j]!, out[i]!];
        }
        return out;
    };
    const left = shuffled(misplaced(0));
    const right = shuffled(misplaced(1));
    const trades = Math.floor(Math.min(left.length, right.length) * FOLD_SUIT_LEAN);
    const tiles = [...board.tiles];
    for (let i = 0; i < trades; i += 1) {
        const [a, b] = [left[i]!, right[i]!];
        [tiles[a], tiles[b]] = [tiles[b]!, tiles[a]!];
    }
    return { ...folded, tiles };
};
