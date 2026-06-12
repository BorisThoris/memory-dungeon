import type { Tile } from '../../shared/contracts';
import type { ResolvingSelectionState } from './tileResolvingSelection';

export const initialTileBoardCardTint = ({
    faceUp,
    isPinned,
    resolvingSelection,
    tile
}: {
    faceUp: boolean;
    isPinned: boolean;
    resolvingSelection: ResolvingSelectionState;
    tile: Tile;
}): string => {
    if (isPinned && tile.state === 'hidden') {
        return '#d4b870';
    }

    if (resolvingSelection === 'mismatch' && faceUp) {
        return '#ffb4a6';
    }

    if (resolvingSelection === 'gambitNeutral' && faceUp) {
        return '#cfe8f2';
    }

    return '#ffffff';
};
