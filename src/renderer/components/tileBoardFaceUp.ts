import type { Tile } from '../../shared/contracts';

export const isTileBoardFaceUp = ({
    debugPeekActive,
    peekRevealedTileIds,
    previewActive,
    tile
}: {
    debugPeekActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    tile: Tile;
}): boolean => tile.state !== 'hidden' || previewActive || debugPeekActive || peekRevealedTileIds.has(tile.id);
