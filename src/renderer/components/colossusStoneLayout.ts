import type { BoardState } from '../../shared/contracts';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH, getTileColumnSpacing, TILE_SPACING } from './tileShatter';

/**
 * Where the Colossus stands (`ColossusStone.tsx`): two cells wide and two tall, centred over the
 * grid in two rows the board's fit keeps free above row 0. The rows are kept for the whole floor a
 * rules-63 Colossus was raised on, felled or broken, so the board never re-fits under the player.
 * The grid itself is a cell index list that reflows with the window (`board-layout-rules.ts`), so
 * the Colossus takes no cells from it: it takes the space above it.
 */
export const COLOSSUS_STONE_ROWS = 2;

/** Rows the fit keeps free above the grid: two on a floor a rules-63 Colossus was raised on. */
export const colossusReservedRows = (board: Pick<BoardState, 'colossus'>): number => (board.colossus?.form === 'fixed' ? COLOSSUS_STONE_ROWS : 0);

/**
 * How far the fitted board is lowered so the reserved rows sit above the grid, in board units
 * (the caller scales it by the fit zoom).
 */
export const colossusFitLift = (board: Pick<BoardState, 'colossus'>): number => (colossusReservedRows(board) * TILE_SPACING) / 2;

export const colossusStoneLayout = (board: Pick<BoardState, 'rows'>, compact: boolean, rows = board.rows): { x: number; y: number; width: number; height: number } => ({
    x: 0,
    // Row 0's centre is ((rows - 1) / 2) * spacing; the stone's centre is halfway up the two rows above it.
    y: ((rows - 1) / 2 + 1.5) * TILE_SPACING,
    width: getTileColumnSpacing(compact) + CARD_PLANE_WIDTH,
    height: TILE_SPACING + CARD_PLANE_HEIGHT
});
