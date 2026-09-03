import type { BoardState, HazardTileKind, Tile } from '../../shared/contracts';
import { getEffectivePrimaryExitLock } from '../../shared/board-inspection';
import { EXIT_PAIR_KEY } from '../../shared/tile-identity';
import { hazardTileColor } from './tileBoardThreatColors';
import { tileTraitColor } from '../../shared/tile-trait-rules';
import { ENEMY_HAZARD_COLORS, TRAP_STATE_COLORS } from './tileBoardThreatColors';
import type { TileBoardPowerBackAccent } from './tileBoardRows';
import {
    getTraitInteractionLaneAction,
    TRAIT_INTERACTION_LANE_LABELS,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';

type DungeonUtilityReadabilityKind = 'exit' | 'lever' | 'lock' | 'shop';
export type TileTraitRouteReadabilityTier =
    | 'none'
    | 'selected-followup'
    | 'route-target'
    | 'perk-armed'
    | 'combo'
    | 'surge'
    | 'reward-hot'
    | 'payoff-stack';
export type TileTraitRouteReadabilityIntensity = 'none' | 'setup' | 'ready' | 'surge' | 'cashout' | 'stack';
export type TileTraitRouteBeatTier = 'setup' | 'route' | 'follow-up' | 'surge' | 'cashout';
export type TileTraitRouteCadence = 'none' | 'prime' | 'route' | 'follow-up' | 'surge' | 'cashout';
type TraitLaneReadabilityPattern =
    | 'cash-pip'
    | 'guard-ward'
    | 'tool-cross'
    | 'risk-slash'
    | 'block-bars'
    | 'recall-pair'
    | 'score-pip';
export type TileTraitRouteReadabilityGlyph =
    | 'none'
    | 'prime-cross'
    | 'linked-route'
    | 'next-tap'
    | 'surge-burst'
    | 'cashout-crown'
    | 'payoff-stack';
interface TileTraitRouteReadabilityFlags {
    isPerkArmedBack: boolean;
    isSelectedTraitFollowupBack: boolean;
    isTraitComboBack: boolean;
    isTraitComboSurgeBack: boolean;
    isTraitPayoffStackBack: boolean;
    isTraitRewardHotBack: boolean;
    isTraitRouteTargetBack: boolean;
}

export const getDungeonUtilityReadabilityKind = (
    tile: Pick<Tile, 'dungeonCardKind' | 'dungeonExitLockKind'> & Partial<Pick<Tile, 'id' | 'pairKey'>>,
    board?: BoardState
): DungeonUtilityReadabilityKind | null => {
    const isPrimaryExitTile = tile.id != null && tile.id === board?.dungeonExitTileId;
    if (tile.dungeonCardKind === 'exit' || tile.pairKey === EXIT_PAIR_KEY || isPrimaryExitTile) {
        return 'exit';
    }
    if (tile.dungeonCardKind === 'lever') {
        return 'lever';
    }
    if (tile.dungeonCardKind === 'shop') {
        return 'shop';
    }
    const lockKind =
        board && tile.id === board.dungeonExitTileId
            ? getEffectivePrimaryExitLock({ board }).lockKind
            : tile.dungeonExitLockKind;
    if (
        tile.dungeonCardKind === 'lock' ||
        (lockKind != null && lockKind !== 'none')
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

interface TileBoardReadabilityInput {
    destroyBlockedDecoyBack: boolean;
    enemyOccupiedBack: boolean;
    faceUp: boolean;
    hazardBackAccent: HazardTileKind | null;
    nonPickableBack: boolean;
    objectiveBackAccent: boolean;
    powerBackAccent: TileBoardPowerBackAccent | null;
    perkArmedBack?: boolean;
    routeBackAccent: boolean;
    selectedTraitFollowupBack?: boolean;
    spotlightBountyOnBack: boolean;
    spotlightWardOnBack: boolean;
    stickyFingerSlotMark: boolean;
    traitComboBack: boolean;
    traitComboSurgeBack: boolean;
    traitLaneBack?: TraitInteractionLaneId | null;
    traitRewardHotBack: boolean;
    traitRouteTargetBack: boolean;
    tile: Tile;
    board?: BoardState;
}

interface TileBoardReadabilityState {
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
    isSelectedTraitFollowupBack: boolean;
    isPerkArmedBack: boolean;
    isTraitComboBack: boolean;
    isTraitComboSurgeBack: boolean;
    isTraitPayoffStackBack: boolean;
    isTraitRewardHotBack: boolean;
    isTraitRouteTargetBack: boolean;
    isTrapCard: boolean;
    showFaceReadabilityMarker: boolean;
    showHiddenReadabilityRing: boolean;
    showHiddenReadabilityMarkers: boolean;
    trapReadabilityColor: string;
    traitRouteReadabilityIntensity: TileTraitRouteReadabilityIntensity;
    traitRouteReadabilityTier: TileTraitRouteReadabilityTier;
    traitLaneReadabilityAction: string | null;
    traitLaneReadabilityColor: string | null;
    traitLaneReadabilityId: TraitInteractionLaneId | null;
    traitLaneReadabilityLabel: string | null;
    traitLaneReadabilityPattern: TraitLaneReadabilityPattern | null;
}

/**
 * One colour per interaction lane. Each lane also has a pattern (`getTraitLaneReadabilityPattern`),
 * which is what keeps colour from being the only channel — but the colours still have to hold up:
 * as shipped, guard and the fallback were dE 1.0 apart for a protanope, and tool and recall only
 * 11.5 apart in ordinary vision. Gated in `tileBoardThreatColors.test.ts` with the other palettes.
 */
export const TRAIT_LANE_COLORS = {
    block: '#9e6ffe',
    guard: '#5fbe5f',
    other: '#f8ecbe',
    recall: '#b9fefe',
    risk: '#f83226',
    shard: '#fdbe21',
    tool: '#41cffd'
} as const;

export const getTraitLaneReadabilityColor = (lane: TraitInteractionLaneId): string => {
    if (lane === 'shard') {
        return TRAIT_LANE_COLORS.shard;
    }
    if (lane === 'guard') {
        return TRAIT_LANE_COLORS.guard;
    }
    if (lane === 'tool') {
        return TRAIT_LANE_COLORS.tool;
    }
    if (lane === 'risk') {
        return TRAIT_LANE_COLORS.risk;
    }
    if (lane === 'block') {
        return TRAIT_LANE_COLORS.block;
    }
    if (lane === 'recall') {
        return TRAIT_LANE_COLORS.recall;
    }
    return TRAIT_LANE_COLORS.other;
};

export const getTraitLaneReadabilityPattern = (lane: TraitInteractionLaneId): TraitLaneReadabilityPattern => {
    if (lane === 'shard') {
        return 'cash-pip';
    }
    if (lane === 'guard') {
        return 'guard-ward';
    }
    if (lane === 'tool') {
        return 'tool-cross';
    }
    if (lane === 'risk') {
        return 'risk-slash';
    }
    if (lane === 'block') {
        return 'block-bars';
    }
    if (lane === 'recall') {
        return 'recall-pair';
    }
    return 'score-pip';
};

export const getTraitRouteReadabilityTier = ({
    isTraitComboBack,
    isTraitComboSurgeBack,
    isTraitPayoffStackBack,
    isTraitRewardHotBack,
    isTraitRouteTargetBack,
    isPerkArmedBack,
    isSelectedTraitFollowupBack
}: TileTraitRouteReadabilityFlags): TileTraitRouteReadabilityTier => {
    if (isTraitPayoffStackBack) {
        return 'payoff-stack';
    }
    if (isTraitRewardHotBack) {
        return 'reward-hot';
    }
    if (isTraitComboSurgeBack) {
        return 'surge';
    }
    if (isSelectedTraitFollowupBack) {
        return 'selected-followup';
    }
    if (isTraitComboBack) {
        return 'combo';
    }
    if (isTraitRouteTargetBack) {
        return 'route-target';
    }
    if (isPerkArmedBack) {
        return 'perk-armed';
    }
    return 'none';
};

export const getTraitRouteReadabilityIntensity = (
    tier: TileTraitRouteReadabilityTier
): TileTraitRouteReadabilityIntensity => {
    if (tier === 'payoff-stack') {
        return 'stack';
    }
    if (tier === 'reward-hot') {
        return 'cashout';
    }
    if (tier === 'surge') {
        return 'surge';
    }
    if (tier === 'combo' || tier === 'selected-followup') {
        return 'ready';
    }
    if (tier === 'route-target' || tier === 'perk-armed') {
        return 'setup';
    }
    return 'none';
};

export const getTraitRouteReadabilityBeatTier = (
    tier: TileTraitRouteReadabilityTier
): TileTraitRouteBeatTier | null => {
    if (tier === 'payoff-stack' || tier === 'reward-hot') {
        return 'cashout';
    }
    if (tier === 'surge') {
        return 'surge';
    }
    if (tier === 'selected-followup') {
        return 'follow-up';
    }
    if (tier === 'combo') {
        return 'route';
    }
    if (tier === 'route-target' || tier === 'perk-armed') {
        return 'setup';
    }
    return null;
};

export const getTraitRouteReadabilityBeatCount = (
    beatTier: TileTraitRouteBeatTier | null
): 2 | 3 | 4 | 5 | 0 => {
    if (beatTier === 'cashout') {
        return 5;
    }
    if (beatTier === 'surge') {
        return 4;
    }
    if (beatTier === 'follow-up' || beatTier === 'route') {
        return 3;
    }
    if (beatTier === 'setup') {
        return 2;
    }
    return 0;
};

export const getTraitRouteReadabilityGlyph = (
    tier: TileTraitRouteReadabilityTier
): TileTraitRouteReadabilityGlyph => {
    if (tier === 'payoff-stack') {
        return 'payoff-stack';
    }
    if (tier === 'reward-hot') {
        return 'cashout-crown';
    }
    if (tier === 'surge') {
        return 'surge-burst';
    }
    if (tier === 'selected-followup') {
        return 'next-tap';
    }
    if (tier === 'combo') {
        return 'linked-route';
    }
    if (tier === 'route-target' || tier === 'perk-armed') {
        return 'prime-cross';
    }
    return 'none';
};

export const getTraitRouteReadabilityCadence = (
    tier: TileTraitRouteReadabilityTier
): TileTraitRouteCadence => {
    if (tier === 'payoff-stack' || tier === 'reward-hot') {
        return 'cashout';
    }
    if (tier === 'surge') {
        return 'surge';
    }
    if (tier === 'selected-followup') {
        return 'follow-up';
    }
    if (tier === 'combo') {
        return 'route';
    }
    if (tier === 'route-target' || tier === 'perk-armed') {
        return 'prime';
    }
    return 'none';
};

export const getTraitPreviewReadabilityBeatCount = (previewLineCount: number): 2 | 3 | 4 | 5 => {
    if (previewLineCount <= 1) {
        return 2;
    }
    if (previewLineCount === 2) {
        return 3;
    }
    if (previewLineCount === 3) {
        return 4;
    }
    return 5;
};

export const getTraitPreviewReadabilityTone = (
    previewLineCount: number
): 'ready' | 'surge' | 'cashout' => {
    if (previewLineCount <= 1) {
        return 'ready';
    }
    if (previewLineCount === 2) {
        return 'surge';
    }
    return 'cashout';
};

export const getTraitRouteCadenceAction = (
    cadence: TileTraitRouteCadence
): 'Cash now' | 'Route surge' | 'Next tap' | 'Match route' | 'Prime payoff' | 'None' => {
    if (cadence === 'cashout') {
        return 'Cash now';
    }
    if (cadence === 'surge') {
        return 'Route surge';
    }
    if (cadence === 'follow-up') {
        return 'Next tap';
    }
    if (cadence === 'route') {
        return 'Match route';
    }
    if (cadence === 'prime') {
        return 'Prime payoff';
    }
    return 'None';
};

export const getTileBoardReadabilityState = ({
    destroyBlockedDecoyBack,
    enemyOccupiedBack,
    faceUp,
    hazardBackAccent,
    nonPickableBack,
    objectiveBackAccent,
    powerBackAccent,
    perkArmedBack = false,
    routeBackAccent,
    selectedTraitFollowupBack = false,
    spotlightBountyOnBack,
    spotlightWardOnBack,
    stickyFingerSlotMark,
    traitComboBack,
    traitComboSurgeBack,
    traitLaneBack = null,
    traitRewardHotBack,
    traitRouteTargetBack,
    tile,
    board
}: TileBoardReadabilityInput): TileBoardReadabilityState => {
    const isTrapCard = tile.dungeonCardKind === 'trap';
    const isResolvedTrap = isTrapCard && tile.dungeonCardState === 'resolved';
    const isRevealedTrap = isTrapCard && tile.dungeonCardState === 'revealed';
    const isArmedTrap = isTrapCard && !isResolvedTrap && !isRevealedTrap;
    const isBossCard = tile.dungeonBossId != null;
    const dungeonUtilityKind = getDungeonUtilityReadabilityKind(tile, board);
    const isExitCard = dungeonUtilityKind === 'exit';
    const isLeverCard = dungeonUtilityKind === 'lever';
    const isLockCard = dungeonUtilityKind === 'lock';
    const isShopCard = dungeonUtilityKind === 'shop';
    const isRelicCard = tile.findableKind != null;
    const isSelectedCard = faceUp && tile.state === 'flipped';
    const isSelectedTraitFollowupBack = selectedTraitFollowupBack && !faceUp && tile.state === 'hidden';
    const isPerkArmedBack = perkArmedBack && !faceUp && tile.state === 'hidden';
    const isTraitComboBack = traitComboBack && !faceUp && tile.state === 'hidden';
    const isTraitComboSurgeBack = traitComboSurgeBack && !faceUp && tile.state === 'hidden';
    const isTraitRewardHotBack = traitRewardHotBack && !faceUp && tile.state === 'hidden';
    const isTraitRouteTargetBack = traitRouteTargetBack && !faceUp && tile.state === 'hidden';
    const traitLaneReadabilityId = !faceUp && tile.state === 'hidden' ? traitLaneBack : null;
    const traitLaneReadabilityColor = traitLaneReadabilityId ? getTraitLaneReadabilityColor(traitLaneReadabilityId) : null;
    const traitLaneReadabilityLabel = traitLaneReadabilityId ? TRAIT_INTERACTION_LANE_LABELS[traitLaneReadabilityId] : null;
    const traitLaneReadabilityAction = traitLaneReadabilityId ? getTraitInteractionLaneAction(traitLaneReadabilityId) : null;
    const traitLaneReadabilityPattern = traitLaneReadabilityId
        ? getTraitLaneReadabilityPattern(traitLaneReadabilityId)
        : null;
    const isTraitPayoffStackBack = isTraitComboBack && isTraitRewardHotBack;
    const traitRouteReadabilityTier = getTraitRouteReadabilityTier({
        isTraitComboBack,
        isTraitComboSurgeBack,
        isPerkArmedBack,
        isSelectedTraitFollowupBack,
        isTraitPayoffStackBack,
        isTraitRewardHotBack,
        isTraitRouteTargetBack
    });
    const traitRouteReadabilityIntensity = getTraitRouteReadabilityIntensity(traitRouteReadabilityTier);
    // Same signal as a sentinel hazard, so it reads from the same gated entry rather than a copy.
    const enemyOccupiedColor = ENEMY_HAZARD_COLORS.sentinel;
    /*
     * Safe, seen, and armed. This triple decides whether a player walks into a trap, and as shipped
     * resolved and armed were dE 16 apart for a deuteranope — the safe one and the dangerous one.
     * Gated with the other threat palettes in `tileBoardThreatColors.test.ts`.
     */
    const trapReadabilityColor = isResolvedTrap
        ? TRAP_STATE_COLORS.resolved
        : isRevealedTrap
          ? TRAP_STATE_COLORS.revealed
          : TRAP_STATE_COLORS.armed;
    const faceReadabilityAccentColor = isBossCard
        ? ENEMY_HAZARD_COLORS.boss
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
            ? ENEMY_HAZARD_COLORS.boss
            : dungeonUtilityKind
              ? dungeonUtilityReadabilityColor(dungeonUtilityKind)
              : isTrapCard
                ? trapReadabilityColor
                : objectiveBackAccent
                  ? '#f2d39d'
                  : routeBackAccent
                    ? '#59b4d9'
                    : traitLaneReadabilityColor
                      ? traitLaneReadabilityColor
                    : isSelectedTraitFollowupBack
                      ? '#fff7c4'
                    : isPerkArmedBack
                      ? '#ffe48a'
                    : isTraitRewardHotBack
                      ? '#ffe48a'
                      : isTraitComboSurgeBack
                        ? '#ffd166'
                    : isTraitComboBack
                      ? '#f7f1c2'
                      : isTraitRouteTargetBack
                        ? '#5dd6ff'
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
            isSelectedTraitFollowupBack ||
            isPerkArmedBack ||
            tile.tileTraitKind != null ||
            isTraitRewardHotBack ||
            isTraitComboSurgeBack ||
            isTraitComboBack ||
            isTraitRouteTargetBack ||
            traitLaneReadabilityColor != null ||
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
        isPerkArmedBack,
        isRelicCard,
        isResolvedTrap,
        isRevealedTrap,
        isShopCard,
        isSelectedCard,
        isSelectedTraitFollowupBack,
        isTraitComboBack,
        isTraitComboSurgeBack,
        isTraitPayoffStackBack,
        isTraitRewardHotBack,
        isTraitRouteTargetBack,
        isTrapCard,
        showFaceReadabilityMarker,
        showHiddenReadabilityRing,
        showHiddenReadabilityMarkers: showHiddenReadabilityRing,
        trapReadabilityColor,
        traitRouteReadabilityIntensity,
        traitRouteReadabilityTier,
        traitLaneReadabilityAction,
        traitLaneReadabilityColor,
        traitLaneReadabilityId,
        traitLaneReadabilityLabel,
        traitLaneReadabilityPattern
    };
};
