import type { Tile } from './contracts';

/**
 * Sends a tile back face-down after a turn it took part in. A tile that already left the board -
 * matched, or popped by a chunk break - is never dragged back into play by this: hiding a removed
 * tile would put a card the player watched leave back under their finger.
 */
export const hideTileAfterTurn = (tile: Tile): Tile =>
    tile.state === 'matched' || tile.state === 'removed' ? tile : { ...tile, state: 'hidden' as const };
