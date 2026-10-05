import type { Tile } from '../../shared/contracts';

export const isMemorizeCurseHighlighted = ({
    cursedPairKey,
    previewActive,
    tile
}: {
    cursedPairKey: string | null;
    previewActive: boolean;
    tile: Tile;
}): boolean =>
    Boolean(previewActive) &&
    Boolean(cursedPairKey) &&
    tile.pairKey === cursedPairKey &&
    tile.state === 'hidden';

export const isStickyFingerSlotMarked = ({
    flippedTileCount,
    stickyBlockedTileId,
    tile
}: {
    faceUp: boolean;
    flippedTileCount: number;
    stickyBlockedTileId: string | null;
    tile: Tile;
}): boolean =>
    stickyBlockedTileId != null &&
    stickyBlockedTileId === tile.id &&
    flippedTileCount === 0 &&
    // A peek reveals identity, but does not release an opening lock.
    (tile.state === 'matched' || tile.state === 'hidden');
