import type { BoardState, RunStatus, Tile } from '../../shared/contracts';
import { getPairProximityGridDistance } from '../../shared/pairProximityHint';

export const getTileBoardPairProximityDistance = ({
    board,
    pairProximityHintsEnabled,
    runStatus,
    tile
}: {
    board: BoardState;
    pairProximityHintsEnabled: boolean;
    runStatus: RunStatus;
    tile: Tile;
}): number | null => {
    if (
        !pairProximityHintsEnabled ||
        (runStatus !== 'playing' && runStatus !== 'resolving') ||
        tile.state !== 'flipped'
    ) {
        return null;
    }

    return getPairProximityGridDistance(board, tile.id);
};
