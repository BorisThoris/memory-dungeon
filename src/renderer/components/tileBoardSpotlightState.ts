import type { Tile } from '../../shared/contracts';

interface TileBoardSpotlightState {
    spotlightBountyHighlight: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardHighlight: boolean;
    spotlightWardOnBack: boolean;
}

export const getTileBoardSpotlightState = ({
    bountyPairKey,
    faceUp,
    shiftingSpotlightActive,
    tile,
    wardPairKey
}: {
    bountyPairKey: string | null;
    faceUp: boolean;
    shiftingSpotlightActive: boolean;
    tile: Tile;
    wardPairKey: string | null;
}): TileBoardSpotlightState => ({
    spotlightBountyHighlight:
        Boolean(bountyPairKey) && faceUp && tile.state !== 'matched' && tile.pairKey === bountyPairKey,
    spotlightBountyOnBack:
        shiftingSpotlightActive && Boolean(bountyPairKey) && !faceUp && tile.pairKey === bountyPairKey,
    spotlightWardHighlight:
        Boolean(wardPairKey) && faceUp && tile.state !== 'matched' && tile.pairKey === wardPairKey,
    spotlightWardOnBack:
        shiftingSpotlightActive && Boolean(wardPairKey) && !faceUp && tile.pairKey === wardPairKey
});
