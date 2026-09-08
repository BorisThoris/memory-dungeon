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
    getCardFeedbackVisibleTraitPreviewCount,
    getCardFeedbackTraitLaneBeatsAttr,
    getCardFeedbackTraitLaneActionsAttr,
    getCardFeedbackTraitLaneCuesAttr,
    getCardFeedbackTraitLanePrimaryActionAttr,
    getCardFeedbackTraitRouteIntensitiesAttr,
    getCardFeedbackTraitRouteTiersAttr,
    getHiddenSlotsAttr,
    getHiddenTileCount,
    getPickableHiddenSlotsAttr
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
    cardFeedbackVisibleTraitPreviewCount: number;
    cardFeedbackTraitLaneBeatsAttr: string;
    cardFeedbackTraitLaneActionsAttr: string;
    cardFeedbackTraitLaneCuesAttr: string;
    cardFeedbackTraitLanePrimaryActionAttr: string;
    cardFeedbackTraitRouteIntensitiesAttr: string;
    cardFeedbackTraitRouteTiersAttr: string;
    hiddenSlotsAttr: string;
    hiddenTileCount: number;
    pickableHiddenSlotsAttr: string | undefined;
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
    selectedTraitFollowupTileIds?: readonly string[];
    traitRewardHotTileIds?: readonly string[];
    traitRouteTargetTileIds?: readonly string[];
}): TileBoardDomSurfaceModel => ({
    cardFeedbackActionCuesAttr: getCardFeedbackActionCuesAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackActionPriorityAttr: getCardFeedbackActionPriorityAttr({
        board,
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
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackPrimaryActionAttr: getCardFeedbackPrimaryActionAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackPrimaryCardCueAttr: getCardFeedbackPrimaryCardCueAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackRouteGlyphsAttr: getCardFeedbackRouteGlyphsAttr({
        board,
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
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackVisibleTraitPreviewCount: getCardFeedbackVisibleTraitPreviewCount({
        board,
        debugPeekActive,
        peekRevealedTileIds,
        previewActive
    }),
    cardFeedbackTraitRouteTiersAttr: getCardFeedbackTraitRouteTiersAttr({
        board,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds,
        traitRouteTargetTileIds
    }),
    cardFeedbackTraitRouteIntensitiesAttr: getCardFeedbackTraitRouteIntensitiesAttr({
        board,
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
    pickableHiddenSlotsAttr: getPickableHiddenSlotsAttr({
        allowGambitThirdFlip,
        board,
        includeDevAttributes,
        interactive
    })
});
