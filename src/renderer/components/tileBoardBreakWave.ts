import type { BoardState, Tile } from '../../shared/contracts';
import { getSafeBoardColumns } from '../../shared/board-grid-dimensions';

/** Seconds of wave per grid step, so a chunk reads as a spread from the match, not a blink. */
export const BREAK_WAVE_SECONDS_PER_STEP = 0.07;
/** No tile waits longer than this, whatever the board size; past it the wave reads as lag. */
export const BREAK_WAVE_MAX_DELAY_SECONDS = 0.6;

/**
 * How long a removed tile waits before it bursts and leaves.
 *
 * The chunk broke around a match, so the wave spreads out from that match: each removed tile
 * departs after a delay proportional to its distance from the nearest matched tile of its own
 * suit — the match that caused the break shares the suit, and on the rare board where two
 * matched clumps share one it is still the nearest that reads right. Computed from the board
 * alone, in the tile, so nothing has to be threaded from the turn event through six components.
 */
export const getBreakWaveDelaySec = (board: Pick<BoardState, 'columns' | 'tiles'>, tile: Tile): number => {
    if (tile.state !== 'removed' || !tile.suit) {
        return 0;
    }
    const columns = getSafeBoardColumns(board);
    const selfIndex = board.tiles.findIndex((candidate) => candidate.id === tile.id);
    if (selfIndex < 0) {
        return 0;
    }
    const selfRow = Math.floor(selfIndex / columns);
    const selfCol = selfIndex % columns;
    let nearest = Number.POSITIVE_INFINITY;
    board.tiles.forEach((candidate, index) => {
        if (candidate.state !== 'matched' || candidate.suit !== tile.suit) {
            return;
        }
        const distance = Math.abs(Math.floor(index / columns) - selfRow) + Math.abs((index % columns) - selfCol);
        if (distance < nearest) {
            nearest = distance;
        }
    });
    if (!Number.isFinite(nearest)) {
        return 0;
    }
    return Math.min(BREAK_WAVE_MAX_DELAY_SECONDS, nearest * BREAK_WAVE_SECONDS_PER_STEP);
};
