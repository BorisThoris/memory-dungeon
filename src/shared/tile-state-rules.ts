import type { Tile } from './contracts';

export const isSprungTrapTile = (tile: Tile): boolean =>
    tile.dungeonCardKind === 'trap' &&
    tile.dungeonCardState === 'resolved' &&
    tile.state !== 'matched' &&
    tile.state !== 'removed';

export const hiddenUnlessSprungTrap = (tile: Tile): Tile =>
    isSprungTrapTile(tile) ? { ...tile, state: 'flipped' as const } : { ...tile, state: 'hidden' as const };
