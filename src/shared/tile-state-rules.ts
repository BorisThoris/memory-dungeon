import type { Tile } from './contracts';

/**
 * Nothing on a generated board springs any more: no trap card is ever dealt, so no tile is ever a
 * sprung trap. The export stays for `board-inspection.ts`, which still asks.
 */
export const isSprungTrapTile = (_tile: Tile): boolean => false;

/**
 * Sends a tile back face-down after a turn it took part in. A tile that already left the board -
 * matched, or popped by a chunk break - is never dragged back into play by this: hiding a removed
 * tile would put a card the player watched leave back under their finger.
 */
export const hideTileAfterTurn = (tile: Tile): Tile =>
    tile.state === 'matched' || tile.state === 'removed' ? tile : { ...tile, state: 'hidden' as const };
