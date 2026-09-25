import type { RunStatus, Tile } from '../../shared/contracts';

interface TileBoardPresentationState {
    presentationNBackAnchor: boolean;
    presentationSilhouette: boolean;
    presentationWideRecall: boolean;
}

export const getTileBoardPresentationState = ({
    faceUp,
    nBackAnchorMarkedTileId,
    nBackMutatorActive,
    runStatus,
    silhouetteDuringPlay,
    tile,
    wideRecallInPlay
}: {
    faceUp: boolean;
    /** The one card the anchor marks (`anchorMarkedTileId`); its partner is the player's to find. */
    nBackAnchorMarkedTileId: string | null;
    nBackMutatorActive: boolean;
    runStatus: RunStatus;
    silhouetteDuringPlay: boolean;
    tile: Tile;
    wideRecallInPlay: boolean;
}): TileBoardPresentationState => {
    const inPlayFlip = runStatus === 'playing' && faceUp && tile.state === 'flipped';

    return {
        presentationNBackAnchor: Boolean(
            nBackMutatorActive &&
                runStatus === 'playing' &&
                nBackAnchorMarkedTileId != null &&
                tile.id === nBackAnchorMarkedTileId &&
                tile.state === 'hidden' &&
                !faceUp
        ),
        presentationSilhouette: Boolean(silhouetteDuringPlay && inPlayFlip),
        presentationWideRecall: Boolean(wideRecallInPlay && inPlayFlip)
    };
};
