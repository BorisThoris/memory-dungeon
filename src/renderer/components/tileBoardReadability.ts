import type { HazardTileKind, Tile } from '../../shared/contracts';
import { hazardTileColor } from './tileBoardThreatColors';
import { tileTraitColor } from '../../shared/tile-trait-rules';
import type { TileBoardPowerBackAccent } from './tileBoardRows';

export type DungeonUtilityReadabilityKind = 'exit' | 'lever' | 'lock' | 'shop';

export const getDungeonUtilityReadabilityKind = (
    tile: Pick<Tile, 'dungeonCardKind' | 'dungeonExitLockKind'>
): DungeonUtilityReadabilityKind | null => {
    if (tile.dungeonCardKind === 'exit') {
        return 'exit';
    }
    if (tile.dungeonCardKind === 'lever') {
        return 'lever';
    }
    if (tile.dungeonCardKind === 'shop') {
        return 'shop';
    }
    if (
        tile.dungeonCardKind === 'lock' ||
        (tile.dungeonExitLockKind != null && tile.dungeonExitLockKind !== 'none')
    ) {
        return 'lock';
    }
    return null;
};

const dungeonUtilityReadabilityColor = (kind: DungeonUtilityReadabilityKind): string => {
    if (kind === 'exit') {
        return '#7bd88f';
    }
    if (kind === 'lever') {
        return '#d4a03d';
    }
    if (kind === 'shop') {
        return '#5ee0c8';
    }
    return '#f2d39d';
};

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
    isExitCard: boolean;
    isLeverCard: boolean;
    isLockCard: boolean;
    isRelicCard: boolean;
    isResolvedTrap: boolean;
    isRevealedTrap: boolean;
    isShopCard: boolean;
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
    const dungeonUtilityKind = getDungeonUtilityReadabilityKind(tile);
    const isExitCard = dungeonUtilityKind === 'exit';
    const isLeverCard = dungeonUtilityKind === 'lever';
    const isLockCard = dungeonUtilityKind === 'lock';
    const isShopCard = dungeonUtilityKind === 'shop';
    const isRelicCard = tile.findableKind != null;
    const isSelectedCard = faceUp && tile.state === 'flipped';
    const enemyOccupiedColor = '#ff9f86';
    const trapReadabilityColor = isResolvedTrap ? '#7bd88f' : isRevealedTrap ? '#ffcf66' : '#ff7a6a';
    const faceReadabilityAccentColor = isBossCard
        ? '#ffcf66'
        : dungeonUtilityKind
          ? dungeonUtilityReadabilityColor(dungeonUtilityKind)
          : isTrapCard
            ? trapReadabilityColor
            : isRelicCard
              ? '#5ee0c8'
              : tile.routeSpecialKind || tile.routeCardKind
                ? '#59b4d9'
                : tile.tileHazardKind
                  ? hazardTileColor(tile.tileHazardKind)
                  : tile.tileTraitKind
                    ? tileTraitColor(tile.tileTraitKind)
                    : '#f2d39d';
    const hiddenReadabilityAccentColor = enemyOccupiedBack
        ? enemyOccupiedColor
        : hazardBackAccent
          ? hazardTileColor(hazardBackAccent)
          : isBossCard
            ? '#ffcf66'
            : dungeonUtilityKind
              ? dungeonUtilityReadabilityColor(dungeonUtilityKind)
              : isTrapCard
                ? trapReadabilityColor
                : objectiveBackAccent
                  ? '#f2d39d'
                  : routeBackAccent
                    ? '#59b4d9'
                    : tile.tileTraitKind
                      ? tileTraitColor(tile.tileTraitKind)
                      : powerBackAccent === 'destroy'
                        ? '#d94848'
                        : powerBackAccent === 'peek'
                          ? '#59b4d9'
                          : powerBackAccent === 'stray'
                            ? '#d4a03d'
                            : powerBackAccent === 'pin'
                              ? '#e8c878'
                              : powerBackAccent === 'swap'
                                ? '#5dd6ff'
                                : powerBackAccent === 'swapOrigin'
                                  ? '#f2f9ff'
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
            isExitCard ||
            isLockCard ||
            isLeverCard ||
            isShopCard ||
            isTrapCard ||
            isBossCard ||
            isRelicCard ||
            tile.tileTraitKind != null ||
            stickyFingerSlotMark);
    const showFaceReadabilityMarker =
        faceUp &&
        tile.state !== 'matched' &&
        (isBossCard ||
            isExitCard ||
            isLockCard ||
            isLeverCard ||
            isShopCard ||
            isTrapCard ||
            isRelicCard ||
            tile.routeSpecialKind != null ||
            tile.routeCardKind != null ||
            tile.tileHazardKind != null ||
            tile.tileTraitKind != null);

    return {
        enemyOccupiedColor,
        faceReadabilityAccentColor,
        hiddenReadabilityAccentColor,
        isArmedTrap,
        isBossCard,
        isExitCard,
        isLeverCard,
        isLockCard,
        isRelicCard,
        isResolvedTrap,
        isRevealedTrap,
        isShopCard,
        isSelectedCard,
        isTrapCard,
        showFaceReadabilityMarker,
        showHiddenReadabilityRing,
        showHiddenReadabilityMarkers: showHiddenReadabilityRing,
        trapReadabilityColor
    };
};
