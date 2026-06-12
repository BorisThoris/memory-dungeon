import type { BoardState, Tile } from '../../shared/contracts';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from '../../shared/tile-identity';

export const getTutorialPairOrdinalByKey = (
    board: BoardState,
    showTutorialPairMarkers: boolean
): Map<string, number> | null => {
    if (!showTutorialPairMarkers) {
        return null;
    }

    const keys = [
        ...new Set(
            board.tiles
                .map((tile) => tile.pairKey)
                .filter((key) => key !== DECOY_PAIR_KEY && key !== WILD_PAIR_KEY)
        )
    ].sort();
    const ordinalByKey = new Map<string, number>();
    for (let index = 0; index < keys.length; index += 1) {
        ordinalByKey.set(keys[index]!, index + 1);
    }
    return ordinalByKey;
};

export const getTileBoardTutorialPairOrdinal = ({
    faceUp,
    showTutorialPairMarkers,
    tile,
    tutorialPairOrdinalByKey
}: {
    faceUp: boolean;
    showTutorialPairMarkers: boolean;
    tile: Tile;
    tutorialPairOrdinalByKey: ReadonlyMap<string, number> | null;
}): number | null => {
    if (!showTutorialPairMarkers || tile.state !== 'hidden' || faceUp) {
        return null;
    }

    return tutorialPairOrdinalByKey?.get(tile.pairKey) ?? null;
};
