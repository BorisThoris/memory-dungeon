import type { Tile } from '../../shared/contracts';
import { tileTraitColor } from '../../shared/tile-trait-rules';
import type { TileBoardPowerBackAccent } from './tileBoardRows';
import {
    getTraitInteractionLaneAction,
    TRAIT_INTERACTION_LANE_LABELS,
    type TraitInteractionLaneId
} from '../copy/traitInteractionLaneMap';

export type TileTraitRouteReadabilityTier =
    | 'none'
    | 'selected-followup'
    | 'route-target'
    | 'combo'
    | 'surge'
    | 'reward-hot'
    | 'payoff-stack';
export type TileTraitRouteReadabilityIntensity = 'none' | 'setup' | 'ready' | 'surge' | 'cashout' | 'stack';
export type TileTraitRouteBeatTier = 'setup' | 'route' | 'follow-up' | 'surge' | 'cashout';
export type TileTraitRouteCadence = 'none' | 'prime' | 'route' | 'follow-up' | 'surge' | 'cashout';
type TraitLaneReadabilityPattern =
    | 'tool-cross'
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
    isSelectedTraitFollowupBack: boolean;
    isTraitComboBack: boolean;
    isTraitComboSurgeBack: boolean;
    isTraitPayoffStackBack: boolean;
    isTraitRewardHotBack: boolean;
    isTraitRouteTargetBack: boolean;
}

interface TileBoardReadabilityInput {
    faceUp: boolean;
    nonPickableBack: boolean;
    powerBackAccent: TileBoardPowerBackAccent | null;
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
}

interface TileBoardReadabilityState {
    faceReadabilityAccentColor: string;
    hiddenReadabilityAccentColor: string;
    isFindableCard: boolean;
    isSelectedCard: boolean;
    isSelectedTraitFollowupBack: boolean;
    isTraitComboBack: boolean;
    isTraitComboSurgeBack: boolean;
    isTraitPayoffStackBack: boolean;
    isTraitRewardHotBack: boolean;
    isTraitRouteTargetBack: boolean;
    showFaceReadabilityMarker: boolean;
    showHiddenReadabilityRing: boolean;
    showHiddenReadabilityMarkers: boolean;
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
 * 11.5 apart in ordinary vision. Gated in `tileBoardReadability.test.ts`.
 */
/* Gen 201: the shard, guard and risk lanes went with the currencies and hazards they named. */
export const TRAIT_LANE_COLORS = {
    block: '#9e6ffe',
    other: '#f8ecbe',
    recall: '#b9fefe',
    tool: '#41cffd'
} as const;

export const getTraitLaneReadabilityColor = (lane: TraitInteractionLaneId): string => {
    if (lane === 'tool') {
        return TRAIT_LANE_COLORS.tool;
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
    if (lane === 'tool') {
        return 'tool-cross';
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
    if (tier === 'route-target') {
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
    if (tier === 'route-target') {
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
    if (tier === 'route-target') {
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
    if (tier === 'route-target') {
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
    faceUp,
    nonPickableBack,
    powerBackAccent,
    selectedTraitFollowupBack = false,
    spotlightBountyOnBack,
    spotlightWardOnBack,
    stickyFingerSlotMark,
    traitComboBack,
    traitComboSurgeBack,
    traitLaneBack = null,
    traitRewardHotBack,
    traitRouteTargetBack,
    tile
}: TileBoardReadabilityInput): TileBoardReadabilityState => {
    const isFindableCard = tile.findableKind != null;
    const isSelectedCard = faceUp && tile.state === 'flipped';
    const isSelectedTraitFollowupBack = selectedTraitFollowupBack && !faceUp && tile.state === 'hidden';
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
        isSelectedTraitFollowupBack,
        isTraitPayoffStackBack,
        isTraitRewardHotBack,
        isTraitRouteTargetBack
    });
    const traitRouteReadabilityIntensity = getTraitRouteReadabilityIntensity(traitRouteReadabilityTier);
    const faceReadabilityAccentColor = isFindableCard
        ? '#5ee0c8'
        : tile.tileTraitKind
          ? tileTraitColor(tile.tileTraitKind)
          : '#f2d39d';
    const hiddenReadabilityAccentColor = traitLaneReadabilityColor
        ? traitLaneReadabilityColor
        : isSelectedTraitFollowupBack
          ? '#fff7c4'
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
                    : powerBackAccent === 'peek'
                      ? '#59b4d9'
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
            powerBackAccent != null ||
            nonPickableBack ||
            isFindableCard ||
            isSelectedTraitFollowupBack ||
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
        (isFindableCard || tile.tileTraitKind != null);

    return {
        faceReadabilityAccentColor,
        hiddenReadabilityAccentColor,
        isFindableCard,
        isSelectedCard,
        isSelectedTraitFollowupBack,
        isTraitComboBack,
        isTraitComboSurgeBack,
        isTraitPayoffStackBack,
        isTraitRewardHotBack,
        isTraitRouteTargetBack,
        showFaceReadabilityMarker,
        showHiddenReadabilityRing,
        showHiddenReadabilityMarkers: showHiddenReadabilityRing,
        traitRouteReadabilityIntensity,
        traitRouteReadabilityTier,
        traitLaneReadabilityAction,
        traitLaneReadabilityColor,
        traitLaneReadabilityId,
        traitLaneReadabilityLabel,
        traitLaneReadabilityPattern
    };
};
