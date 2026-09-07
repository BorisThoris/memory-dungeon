import type { Tile } from './contracts';

/**
 * A trap that has been sealed rather than sprung: its card is resolved, but the tile is still
 * sitting on the board face-up. A trap the player set off pops off the board instead (see
 * `springArmedDungeonTraps`), so this now describes only the rune-seal path.
 */
export const isSprungTrapTile = (tile: Tile): boolean =>
    tile.dungeonCardKind === 'trap' &&
    tile.dungeonCardState === 'resolved' &&
    tile.state !== 'matched' &&
    tile.state !== 'removed';

/**
 * Sends a tile back face-down after a turn it took part in, unless it is a sealed trap, which
 * stays face-up. A tile that already left the board — matched, or popped by a trap spring or a
 * chunk break — is never dragged back into play by this: hiding a removed tile would put a card
 * the player watched leave back under their finger.
 */
export const hiddenUnlessSprungTrap = (tile: Tile): Tile =>
    tile.state === 'matched' || tile.state === 'removed'
        ? tile
        : isSprungTrapTile(tile)
          ? { ...tile, state: 'flipped' as const }
          : { ...tile, state: 'hidden' as const };
