export const isTileBoardFlipLocked = ({
    allowGambitThirdFlip,
    flippedTileCount
}: {
    allowGambitThirdFlip: boolean;
    flippedTileCount: number;
}): boolean => flippedTileCount >= 2 && !(allowGambitThirdFlip && flippedTileCount === 2);
