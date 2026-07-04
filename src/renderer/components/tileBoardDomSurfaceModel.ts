import type { BoardState, RunStatus } from '../../shared/contracts';
import {
    getCardFeedbackActionCuesAttr,
    getCardFeedbackActionPriorityAttr,
    getCardFeedbackBeatCountsAttr,
    getCardFeedbackBeatTiersAttr,
    getCardFeedbackCadencesAttr,
    getCardFeedbackMarkerShapesAttr,
    getCardFeedbackPrimaryActionAttr,
    getCardFeedbackPrimaryCardCueAttr,
    getCardFeedbackRouteGlyphsAttr,
    getCardFeedbackStatesAttr,
    getCardFeedbackTraitLaneBeatsAttr,
    getCardFeedbackTraitLaneActionsAttr,
    getCardFeedbackTraitLaneCuesAttr,
    getCardFeedbackTraitLanePrimaryActionAttr,
    getCardFeedbackTraitRouteIntensitiesAttr,
    getCardFeedbackTraitRouteTiersAttr,
    getHiddenSlotsAttr,
    getHiddenTileCount,
    getHiddenTrapSlotsAttr,
    getPickableHiddenSlotsAttr,
    getResolvedTrapSlotsAttr,
    getResolvedTrapTileCount
} from './tileBoardDomTelemetry';

interface TileBoardDomSurfaceModel {
    cardFeedbackActionCuesAttr: string;
    cardFeedbackActionPriorityAttr: string;
    cardFeedbackBeatCountsAttr: string;
    cardFeedbackBeatTiersAttr: string;
    cardFeedbackCadencesAttr: string;
    cardFeedbackMarkerShapesAttr: string;
    cardFeedbackPrimaryActionAttr: string;
    cardFeedbackPrimaryCardCueAttr: string;
    cardFeedbackRouteGlyphsAttr: string;
    cardFeedbackStatesAttr: string | undefined;
    cardFeedbackTraitLaneBeatsAttr: string;
    cardFeedbackTraitLaneActionsAttr: string;
    cardFeedbackTraitLaneCuesAttr: string;
    cardFeedbackTraitLanePrimaryActionAttr: string;
    cardFeedbackTraitRouteIntensitiesAttr: string;
    cardFeedbackTraitRouteTiersAttr: string;
    hiddenSlotsAttr: string;
    hiddenTileCount: number;
    hiddenTrapSlotsAttr: string | undefined;
    pickableHiddenSlotsAttr: string | undefined;
    resolvedTrapSlotsAttr: string | undefined;
    resolvedTrapTileCount: number;
}

export const buildTileBoardDomSurfaceModel = ({
    allowGambitThirdFlip,
    board,
    boardApplicationFocused,
    debugPeekActive,
    focusedTileId,
    includeDevAttributes,
    interactive,
    peekRevealedTileIds,
    previewActive,
    runStatus,
    perkArmedTileIds = [],
    selectedTraitFollowupTileIds,
    traitRewardHotTileIds = [],
    traitRouteTargetTileIds = []
}: {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    boardApplicationFocused: boolean;
    debugPeekActive: boolean;
    focusedTileId: string | null;
    includeDevAttributes: boolean;
    interactive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    runStatus: RunStatus;
    perkArmedTileIds?: readonly string[];
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): TileBoardDomSurfaceModel => ({
    cardFeedbackActionCuesAttr: getCardFeedbackActionCuesAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackActionPriorityAttr: getCardFeedbackActionPriorityAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackBeatTiersAttr: getCardFeedbackBeatTiersAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackBeatCountsAttr: getCardFeedbackBeatCountsAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackCadencesAttr: getCardFeedbackCadencesAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackMarkerShapesAttr: getCardFeedbackMarkerShapesAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackPrimaryActionAttr: getCardFeedbackPrimaryActionAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackPrimaryCardCueAttr: getCardFeedbackPrimaryCardCueAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackRouteGlyphsAttr: getCardFeedbackRouteGlyphsAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackStatesAttr: getCardFeedbackStatesAttr({
        allowGambitThirdFlip,
        board,
        boardApplicationFocused,
        debugPeekActive,
        focusedTileId,
        interactive,
        peekRevealedTileIds,
        previewActive,
        runStatus,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackTraitRouteTiersAttr: getCardFeedbackTraitRouteTiersAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackTraitRouteIntensitiesAttr: getCardFeedbackTraitRouteIntensitiesAttr({
        board,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackTraitLaneBeatsAttr: getCardFeedbackTraitLaneBeatsAttr(board),
    cardFeedbackTraitLaneActionsAttr: getCardFeedbackTraitLaneActionsAttr(board),
    cardFeedbackTraitLaneCuesAttr: getCardFeedbackTraitLaneCuesAttr(board),
    cardFeedbackTraitLanePrimaryActionAttr: getCardFeedbackTraitLanePrimaryActionAttr(board),
    hiddenSlotsAttr: getHiddenSlotsAttr(board),
    hiddenTileCount: getHiddenTileCount(board),
    hiddenTrapSlotsAttr: getHiddenTrapSlotsAttr(board, includeDevAttributes),
    pickableHiddenSlotsAttr: getPickableHiddenSlotsAttr({
        allowGambitThirdFlip,
        board,
        includeDevAttributes,
        interactive
    }),
    resolvedTrapSlotsAttr: getResolvedTrapSlotsAttr(board),
    resolvedTrapTileCount: getResolvedTrapTileCount(board)
});
