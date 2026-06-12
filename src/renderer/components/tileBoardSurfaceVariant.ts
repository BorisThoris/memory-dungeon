import type { Tile } from '../../shared/contracts';
import type { ResolvingSelectionState } from './tileResolvingSelection';
import type { FaceVariant } from './tileTextures';

export const getTileBoardSurfaceVariant = (
    tile: Tile,
    faceUp: boolean,
    resolving: ResolvingSelectionState
): FaceVariant => {
    if (tile.state === 'matched') {
        return 'matched';
    }

    if (faceUp && resolving === 'mismatch') {
        return 'mismatch';
    }

    if (faceUp && resolving === 'gambitNeutral') {
        return 'active';
    }

    return faceUp ? 'active' : 'hidden';
};
