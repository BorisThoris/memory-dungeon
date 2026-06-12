import type { HazardTileKind, Tile } from '../../shared/contracts';
import { hazardTileColor } from './tileBoardThreatColors';
import type { TileBoardPowerBackAccent } from './tileBoardRows';

export interface TileBoardReadabilityInput {
    destroyBlockedDecoyBack: boolean;
    enemyOccupiedBack: boolean;
    faceUp: boolean;
    hazardBackAccent: HazardTileKind | null;
    nonPickableBack: boolean;
    objectiveBackAccent: boolean;
    powerBackAccent: TileBoardPowerBackAccent | null;
    routeBackAccent: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardOnBack: boolean;
    stickyFingerSlotMark: boolean;
    tile: Tile;
}

export interface TileBoardReadabilityState {
    enemyOccupiedColor: string;
    faceReadabilityAccentColor: string;
    hiddenReadabilityAccentColor: string;
    isArmedTrap: boolean;
    isBossCard: boolean;
    isRelicCard: boolean;
    isResolvedTrap: boolean;
    isRevealedTrap: boolean;
    isSelectedCard: boolean;
    isTrapCard: boolean;
    showFaceReadabilityMarker: boolean;
    showHiddenReadabilityRing: boolean;
    showHiddenReadabilityMarkers: boolean;
    trapReadabilityColor: string;
}

export const getTileBoardReadabilityState = ({
    destroyBlockedDecoyBack,
    enemyOccupiedBack,
    faceUp,
    hazardBackAccent,
    nonPickableBack,
    objectiveBackAccent,
    powerBackAccent,
    routeBackAccent,
    spotlightBountyOnBack,
    spotlightWardOnBack,
    stickyFingerSlotMark,
    tile
}: TileBoardReadabilityInput): TileBoardReadabilityState => {
    const isTrapCard = tile.dungeonCardKind === 'trap';
    const isResolvedTrap = isTrapCard && tile.dungeonCardState === 'resolved';
    const isRevealedTrap = isTrapCard && tile.dungeonCardState === 'revealed';
    const isArmedTrap = isTrapCard && !isResolvedTrap && !isRevealedTrap;
    const isBossCard = tile.dungeonBossId != null;
    const isRelicCard = tile.findableKind != null;
    const isSelectedCard = faceUp && tile.state === 'flipped';
    const enemyOccupiedColor = '#ff9f86';
    const trapReadabilityColor = isResolvedTrap ? '#7bd88f' : isRevealedTrap ? '#ffcf66' : '#ff7a6a';
    const faceReadabilityAccentColor = isBossCard
        ? '#ffcf66'
        : isTrapCard
          ? trapReadabilityColor
          : isRelicCard
            ? '#5ee0c8'
            : tile.routeSpecialKind || tile.routeCardKind
              ? '#59b4d9'
              : tile.tileHazardKind
                ? hazardTileColor(tile.tileHazardKind)
                : '#f2d39d';
    const hiddenReadabilityAccentColor = enemyOccupiedBack
        ? enemyOccupiedColor
        : hazardBackAccent
          ? hazardTileColor(hazardBackAccent)
          : isBossCard
            ? '#ffcf66'
            : isTrapCard
              ? trapReadabilityColor
              : objectiveBackAccent
                ? '#f2d39d'
                : routeBackAccent
                  ? '#59b4d9'
                  : powerBackAccent === 'destroy'
                    ? '#d94848'
                    : powerBackAccent === 'peek'
                      ? '#59b4d9'
                      : powerBackAccent === 'stray'
                        ? '#d4a03d'
                        : powerBackAccent === 'pin'
                          ? '#e8c878'
                          : '#b6a4bd';
    const showHiddenReadabilityRing =
        !faceUp &&
        tile.state === 'hidden' &&
        (spotlightWardOnBack ||
            spotlightBountyOnBack ||
            destroyBlockedDecoyBack ||
            powerBackAccent != null ||
            hazardBackAccent != null ||
            routeBackAccent ||
            objectiveBackAccent ||
            enemyOccupiedBack ||
            nonPickableBack ||
            isTrapCard ||
            isBossCard ||
            isRelicCard ||
            stickyFingerSlotMark);
    const showFaceReadabilityMarker =
        faceUp &&
        tile.state !== 'matched' &&
        (isBossCard ||
            isTrapCard ||
            isRelicCard ||
            tile.routeSpecialKind != null ||
            tile.routeCardKind != null ||
            tile.tileHazardKind != null);

    return {
        enemyOccupiedColor,
        faceReadabilityAccentColor,
        hiddenReadabilityAccentColor,
        isArmedTrap,
        isBossCard,
        isRelicCard,
        isResolvedTrap,
        isRevealedTrap,
        isSelectedCard,
        isTrapCard,
        showFaceReadabilityMarker,
        showHiddenReadabilityRing,
        showHiddenReadabilityMarkers: showHiddenReadabilityRing,
        trapReadabilityColor
    };
};
