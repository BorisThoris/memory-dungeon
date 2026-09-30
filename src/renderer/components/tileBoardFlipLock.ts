/**
 * Whether the board takes no more cards face up this turn - the one formula for it; the pick
 * slabs, the keyboard grid and the DOM surface all ask here.
 *
 * An ordinary turn holds two cards and a Gambit a third. A Zone holds as many as it was opened
 * with (`zone-rules.ts`, two per pair), and until this took that into account the Zone's third
 * card could not be tapped: the board locked at two while the rules were still waiting for more.
 */
export const isTileBoardFlipLocked = ({
    allowGambitThirdFlip,
    flippedTileCount,
    zoneFlipCapacity = 0
}: {
    allowGambitThirdFlip: boolean;
    flippedTileCount: number;
    zoneFlipCapacity?: number;
}): boolean => {
    if (zoneFlipCapacity > 0) {
        return flippedTileCount >= zoneFlipCapacity;
    }
    return flippedTileCount >= 2 && !(allowGambitThirdFlip && flippedTileCount === 2);
};
