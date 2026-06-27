import type { RunStatus, Tile } from '../../shared/contracts';

interface TileBoardPresentationState {
    presentationNBackAnchor: boolean;
    presentationSilhouette: boolean;
    presentationWideRecall: boolean;
}

export const getTileBoardPresentationState = ({
    faceUp,
    nBackAnchorPairKey,
    nBackMutatorActive,
    runStatus,
    silhouetteDuringPlay,
    tile,
    wideRecallInPlay
}: {
    faceUp: boolean;
    nBackAnchorPairKey: string | null;
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
                nBackAnchorPairKey != null &&
                tile.pairKey === nBackAnchorPairKey &&
                inPlayFlip
        ),
        presentationSilhouette: Boolean(silhouetteDuringPlay && inPlayFlip),
        presentationWideRecall: Boolean(wideRecallInPlay && inPlayFlip)
    };
};
