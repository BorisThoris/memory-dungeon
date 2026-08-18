import { formatChainOpportunityBeatLabel } from '../copy/chainOpportunityBeat';
import {
    getTraitInteractionLaneAction,
    getTraitInteractionLaneRole
} from '../copy/traitInteractionLaneMap';
import {
    cardTraitLaneAudioCue,
    cardTraitLaneBeatMapSummaryAction as getCardTraitLaneBeatMapSummaryAction,
    cardTraitLaneScreenCue
} from './tileBoardCardFeedbackState';
import type { buildTileBoardCardFeedbackState } from './tileBoardCardFeedbackState';
import type { buildBoardFeedbackModelState } from './tileBoardFeedbackModelState';
import {
    boardOpportunityAudioCue,
    boardOpportunityScreenCue,
    boardPayoffStackCrescendoAudioCue,
    getBoardChainCalloutAction,
    getBoardChainCalloutAudioCue,
    getBoardChainCalloutScreenCue,
    getBoardChainCueAction,
    getBoardChainCueAudioCue,
    getBoardChainCueScreenCue,
    getBoardChainPriorityAudioCue,
    getBoardChainPriorityScreenCue,
    getBoardOpportunityActionId,
    getBoardOpportunityBeatCount,
    getBoardOpportunityCompassSummaryAction,
    getBoardOpportunityCompassSummaryTier,
    getBoardOpportunityHeat,
    getBoardOpportunityImpactCueId,
    getFocusedPreviewAudioCue,
    getFocusedPreviewBeatCount,
    getFocusedPreviewScreenCue
} from './tileBoardFeedbackCues';
import { buildBoardFeedbackSurfaceState } from './tileBoardFeedbackSurfaceState';

export const buildBoardFeedbackSurfaceComposition = ({
    boardFeedbackModelState,
    cardFeedbackState,
    deps,
    lastResolutionFeedback,
    reduceMotion
}: {
    boardFeedbackModelState: ReturnType<typeof buildBoardFeedbackModelState>;
    cardFeedbackState: ReturnType<typeof buildTileBoardCardFeedbackState>;
    deps: { formatLabel: (label: string, rows: readonly (string | null | undefined)[]) => string };
    lastResolutionFeedback: string;
    reduceMotion: boolean;
}) =>
    buildBoardFeedbackSurfaceState({
        actionPriority: {
            primaryActionId: cardFeedbackState.cardFeedbackPrimaryActionAttr,
            primaryRow: cardFeedbackState.primaryCardActionPriorityRow,
            rows: cardFeedbackState.cardFeedbackActionPriorityRows,
            summaryAction: cardFeedbackState.cardActionPrioritySummaryAction,
            summaryBeatCount: cardFeedbackState.cardActionPrioritySummaryBeatCount,
            summaryScreenCue: cardFeedbackState.cardActionPrioritySummaryScreenCue,
            summaryTier: cardFeedbackState.cardActionPrioritySummaryTier
        },
        beatMap: {
            actionMapAttr: cardFeedbackState.cardFeedbackBeatActionMapAttr,
            label: cardFeedbackState.cardFeedbackBeatMapLabel,
            primaryRow: cardFeedbackState.primaryCardFeedbackBeatRow,
            rows: cardFeedbackState.cardFeedbackBeatRows,
            summaryAction: cardFeedbackState.cardBeatMapSummaryAction,
            summaryBeatCount: cardFeedbackState.cardBeatMapSummaryBeatCount,
            summaryMeterFill: cardFeedbackState.cardBeatMapSummaryMeterFill,
            summaryScreenCue: cardFeedbackState.cardBeatMapSummaryScreenCue,
            summaryTier: cardFeedbackState.cardBeatMapSummaryTier
        },
        cadenceMap: {
            label: cardFeedbackState.cardFeedbackCadenceMapLabel,
            primaryRow: cardFeedbackState.primaryCardFeedbackCadenceRow,
            rows: cardFeedbackState.cardFeedbackCadenceRows,
            summaryAction: cardFeedbackState.cardCadenceMapSummaryAction,
            summaryBeatCount: cardFeedbackState.cardCadenceMapSummaryBeatCount,
            summaryScreenCue: cardFeedbackState.cardCadenceMapSummaryScreenCue,
            summaryTier: cardFeedbackState.cardCadenceMapSummaryTier
        },
        cardTelemetry: {
            cardActionPrioritySummaryAction: cardFeedbackState.cardActionPrioritySummaryAction,
            cardActionPrioritySummaryBeatCount: cardFeedbackState.cardActionPrioritySummaryBeatCount,
            cardActionPrioritySummaryScreenCue: cardFeedbackState.cardActionPrioritySummaryScreenCue,
            cardActionPrioritySummaryTier: cardFeedbackState.cardActionPrioritySummaryTier,
            cardBeatMapSummaryAction: cardFeedbackState.cardBeatMapSummaryAction,
            cardBeatMapSummaryBeatCount: cardFeedbackState.cardBeatMapSummaryBeatCount,
            cardBeatMapSummaryScreenCue: cardFeedbackState.cardBeatMapSummaryScreenCue,
            cardBeatMapSummaryTier: cardFeedbackState.cardBeatMapSummaryTier,
            cardCadenceMapSummaryAction: cardFeedbackState.cardCadenceMapSummaryAction,
            cardCadenceMapSummaryBeatCount: cardFeedbackState.cardCadenceMapSummaryBeatCount,
            cardCadenceMapSummaryScreenCue: cardFeedbackState.cardCadenceMapSummaryScreenCue,
            cardCadenceMapSummaryTier: cardFeedbackState.cardCadenceMapSummaryTier,
            cardFeedbackActionCuesAttr: cardFeedbackState.cardFeedbackActionCuesAttr,
            cardFeedbackActionPriorityAttr: cardFeedbackState.cardFeedbackActionPriorityAttr,
            cardFeedbackActionPriorityRowsLength: cardFeedbackState.cardFeedbackActionPriorityRows.length,
            cardFeedbackBeatCountsAttr: cardFeedbackState.cardFeedbackBeatCountsAttr,
            cardFeedbackBeatRowsLength: cardFeedbackState.cardFeedbackBeatRows.length,
            cardFeedbackBeatTiersAttr: cardFeedbackState.cardFeedbackBeatTiersAttr,
            cardFeedbackCadenceRowsLength: cardFeedbackState.cardFeedbackCadenceRows.length,
            cardFeedbackCadencesAttr: cardFeedbackState.cardFeedbackCadencesAttr,
            cardFeedbackMarkerShapesAttr: cardFeedbackState.cardFeedbackMarkerShapesAttr,
            cardFeedbackPrimaryActionAttr: cardFeedbackState.cardFeedbackPrimaryActionAttr,
            cardFeedbackPrimaryCardCueAttr: cardFeedbackState.cardFeedbackPrimaryCardCueAttr,
            cardFeedbackRouteGlyphsAttr: cardFeedbackState.cardFeedbackRouteGlyphsAttr,
            cardFeedbackShotMapAttr: cardFeedbackState.cardFeedbackShotMapAttr,
            cardFeedbackShotMapRowsLength: cardFeedbackState.cardFeedbackShotMapRows.length,
            cardFeedbackStatesAttr: cardFeedbackState.cardFeedbackStatesAttr,
            cardFeedbackTraitComboSurgeActive: cardFeedbackState.cardFeedbackTraitComboSurgeActive,
            cardFeedbackTraitLaneActionsAttr: cardFeedbackState.cardFeedbackTraitLaneActionsAttr,
            cardFeedbackTraitLaneBeatsAttr: cardFeedbackState.cardFeedbackTraitLaneBeatsAttr,
            cardFeedbackTraitLaneBeatRowsLength: cardFeedbackState.cardFeedbackTraitLaneBeatRows.length,
            cardFeedbackTraitLaneCuesAttr: cardFeedbackState.cardFeedbackTraitLaneCuesAttr,
            cardFeedbackTraitLanePrimaryActionAttr: cardFeedbackState.cardFeedbackTraitLanePrimaryActionAttr,
            cardFeedbackTraitPayoffStackActive: cardFeedbackState.cardFeedbackTraitPayoffStackActive,
            cardFeedbackTraitRouteIntensitiesAttr: cardFeedbackState.cardFeedbackTraitRouteIntensitiesAttr,
            cardFeedbackTraitRouteTiersAttr: cardFeedbackState.cardFeedbackTraitRouteTiersAttr,
            cardFeedbackVisibleTraitPreviewCount: cardFeedbackState.cardFeedbackVisibleTraitPreviewCount,
            cardShotMapSummaryAction: cardFeedbackState.cardShotMapSummaryAction,
            cardShotMapSummaryBeatCount: cardFeedbackState.cardShotMapSummaryBeatCount,
            cardShotMapSummaryScreenCue: cardFeedbackState.cardShotMapSummaryScreenCue,
            cardShotMapSummaryTier: cardFeedbackState.cardShotMapSummaryTier,
            lastResolutionFeedback,
            primaryCardActionPriorityRow: cardFeedbackState.primaryCardActionPriorityRow,
            primaryCardFeedbackBeatRow: cardFeedbackState.primaryCardFeedbackBeatRow,
            primaryCardFeedbackCadenceRow: cardFeedbackState.primaryCardFeedbackCadenceRow,
            primaryCardFeedbackShotAudioCue: cardFeedbackState.primaryCardFeedbackShotAudioCue,
            primaryCardFeedbackShotFocus: cardFeedbackState.primaryCardFeedbackShotFocus,
            primaryCardFeedbackShotRow: cardFeedbackState.primaryCardFeedbackShotRow,
            primaryCardFeedbackShotScreenCue: cardFeedbackState.primaryCardFeedbackShotScreenCue,
            primaryTraitLaneAudioCue: cardFeedbackState.primaryTraitLaneAudioCue,
            primaryTraitLaneBeatRow: cardFeedbackState.primaryTraitLaneBeatRow,
            primaryTraitLaneScreenCue: cardFeedbackState.primaryTraitLaneScreenCue,
            reduceMotion,
            traitLaneBeatMapSummaryAction: cardFeedbackState.traitLaneBeatMapSummaryAction,
            traitLaneBeatMapSummaryBeatCount: cardFeedbackState.traitLaneBeatMapSummaryBeatCount,
            traitLaneBeatMapSummaryScreenCue: cardFeedbackState.traitLaneBeatMapSummaryScreenCue,
            traitLaneBeatMapSummaryTier: cardFeedbackState.traitLaneBeatMapSummaryTier
        },
        chainOpportunityChip: {
            accessibilitySummary: boardFeedbackModelState.boardChainAccessibilitySummary,
            cueMeterFill: boardFeedbackModelState.boardChainCueMeterFill,
            cueMeterState: boardFeedbackModelState.boardChainCueMeterState,
            deps: {
                cardTraitLaneAudioCue,
                cardTraitLaneBeatMapSummaryAction: getCardTraitLaneBeatMapSummaryAction,
                cardTraitLaneScreenCue,
                formatBeatLabel: formatChainOpportunityBeatLabel,
                getCalloutAction: getBoardChainCalloutAction,
                getCalloutAudioCue: getBoardChainCalloutAudioCue,
                getCalloutScreenCue: getBoardChainCalloutScreenCue,
                getCueAction: getBoardChainCueAction,
                getCueAudioCue: getBoardChainCueAudioCue,
                getCueScreenCue: getBoardChainCueScreenCue,
                getPriorityAudioCue: getBoardChainPriorityAudioCue,
                getPriorityScreenCue: getBoardChainPriorityScreenCue,
                getTraitInteractionLaneAction,
                getTraitInteractionLaneRole
            },
            nextActionMeterFill: boardFeedbackModelState.boardChainOpportunityNextActionMeterFill,
            nextActionTier: boardFeedbackModelState.boardChainOpportunityNextActionTier,
            nextActionVerb: boardFeedbackModelState.boardChainOpportunityNextActionVerb,
            opportunity: boardFeedbackModelState.boardChainOpportunity,
            opportunityMeterFill: boardFeedbackModelState.boardChainOpportunityMeterFill,
            primaryShotAudio: cardFeedbackState.primaryCardFeedbackShotAudioCue,
            primaryShotFocus: cardFeedbackState.primaryCardFeedbackShotFocus,
            primaryShotRow: cardFeedbackState.primaryCardFeedbackShotRow,
            primaryShotScreenCue: cardFeedbackState.primaryCardFeedbackShotScreenCue,
            primaryTraitLaneAudio: cardFeedbackState.primaryTraitLaneAudioCue,
            primaryTraitLaneRow: cardFeedbackState.primaryTraitLaneBeatRow,
            primaryTraitLaneScreenCue: cardFeedbackState.primaryTraitLaneScreenCue,
            priorityId: boardFeedbackModelState.boardChainOpportunityPriorityId,
            recipeChips: boardFeedbackModelState.boardChainRecipeChips,
            recipeRows: boardFeedbackModelState.boardChainRecipeRows,
            shotBeatRow: cardFeedbackState.primaryCardFeedbackBeatRow,
            shotCadenceRow: cardFeedbackState.primaryCardFeedbackCadenceRow,
            traitInteractionLaneActionMap: boardFeedbackModelState.boardTraitInteractionLaneActionMapAttrValue,
            traitInteractionLaneAttrValue: boardFeedbackModelState.boardTraitInteractionLaneMapAttrValue,
            traitInteractionLaneMap: boardFeedbackModelState.boardTraitInteractionLaneMap,
            traitInteractionLaneMapAccessibleLabel: boardFeedbackModelState.boardTraitInteractionLaneMapAccessibleLabel,
            traitInteractionLaneMapMeterFill: boardFeedbackModelState.boardTraitInteractionLaneMapMeterFill,
            traitInteractionLanePrimary: boardFeedbackModelState.primaryBoardTraitInteractionLane,
            traitInteractionLaneRoleMap: boardFeedbackModelState.boardTraitInteractionLaneRoleMapAttrValue,
            traitLaneBeatMapLabel: cardFeedbackState.cardFeedbackTraitLaneBeatMapLabel,
            traitLaneBeatMapMeterFill: cardFeedbackState.cardFeedbackTraitLaneBeatMapMeterFill,
            traitLaneBeatRows: cardFeedbackState.cardFeedbackTraitLaneBeatRows,
            traitLaneBeatSummaryAction: cardFeedbackState.traitLaneBeatMapSummaryAction,
            traitLaneBeatSummaryBeatCount: cardFeedbackState.traitLaneBeatMapSummaryBeatCount,
            traitLaneBeatSummaryScreenCue: cardFeedbackState.traitLaneBeatMapSummaryScreenCue,
            traitLaneBeatSummaryTier: cardFeedbackState.traitLaneBeatMapSummaryTier
        },
        chainSurface: {
            accessibleLabel: boardFeedbackModelState.boardChainOpportunityLabel,
            tone: boardFeedbackModelState.boardChainOpportunity.tone
        },
        chainTelemetry: {
            boardChainAccessibilitySummary: boardFeedbackModelState.boardChainAccessibilitySummary,
            boardChainMarkerKeyRowsLength: boardFeedbackModelState.boardChainMarkerKeyRows.length,
            boardChainMarkerKeySummaryAction: boardFeedbackModelState.boardChainMarkerKeySummaryAction,
            boardChainMarkerKeySummaryBeatCount: boardFeedbackModelState.boardChainMarkerKeySummaryBeatCount,
            boardChainMarkerKeySummaryScreenCue: boardFeedbackModelState.boardChainMarkerKeySummaryScreenCue,
            boardChainMarkerKeySummaryTier: boardFeedbackModelState.boardChainMarkerKeySummaryTier,
            boardChainOpportunity: boardFeedbackModelState.boardChainOpportunity,
            boardChainRecipeChips: boardFeedbackModelState.boardChainRecipeChips,
            boardChainSequenceCue: boardFeedbackModelState.boardChainSequenceCue,
            boardRewardLadderState: boardFeedbackModelState.boardRewardLadderState,
            boardTraitInteractionLaneActionMapAttrValue: boardFeedbackModelState.boardTraitInteractionLaneActionMapAttrValue,
            boardTraitInteractionLaneMap: boardFeedbackModelState.boardTraitInteractionLaneMap,
            boardTraitInteractionLaneMapAttrValue: boardFeedbackModelState.boardTraitInteractionLaneMapAttrValue,
            boardTraitInteractionLaneRoleMapAttrValue: boardFeedbackModelState.boardTraitInteractionLaneRoleMapAttrValue
        },
        focusedPreview: {
            accessibleLabel: boardFeedbackModelState.focusedPreviewChipLabel ?? '',
            deps: {
                getAudio: getFocusedPreviewAudioCue,
                getBeatCount: getFocusedPreviewBeatCount,
                getScreenCue: getFocusedPreviewScreenCue
            },
            preview: boardFeedbackModelState.focusedPreviewChip,
            traitOpportunityTileCount: boardFeedbackModelState.traitOpportunitySummary.tiles.length,
            traitPayoffStackActive: cardFeedbackState.cardFeedbackTraitPayoffStackActive
        },
        markerKey: {
            focusedChainMarkerShape: boardFeedbackModelState.focusedChainMarkerShape,
            intensity: boardFeedbackModelState.chainMarkerIntensity,
            rows: boardFeedbackModelState.boardChainMarkerKeyRows,
            summaryAction: boardFeedbackModelState.boardChainMarkerKeySummaryAction,
            summaryBeatCount: boardFeedbackModelState.boardChainMarkerKeySummaryBeatCount,
            summaryMeterFill: boardFeedbackModelState.boardChainMarkerKeyMeterFill,
            summaryScreenCue: boardFeedbackModelState.boardChainMarkerKeySummaryScreenCue,
            summaryTier: boardFeedbackModelState.boardChainMarkerKeySummaryTier
        },
        opportunitySurface: {
            chainOpportunity: boardFeedbackModelState.boardChainOpportunity,
            deps: {
                getActionId: getBoardOpportunityActionId,
                getAudio: boardOpportunityAudioCue,
                getBeatCount: getBoardOpportunityBeatCount,
                getCrescendoAudioCue: boardPayoffStackCrescendoAudioCue,
                getHeat: getBoardOpportunityHeat,
                getImpactCueId: getBoardOpportunityImpactCueId,
                getScreenCue: boardOpportunityScreenCue,
                getSummaryAction: getBoardOpportunityCompassSummaryAction,
                getSummaryTier: getBoardOpportunityCompassSummaryTier
            },
            hazardOpportunity: boardFeedbackModelState.boardHazardOpportunity,
            rows: boardFeedbackModelState.boardOpportunityCompassRows
        },
        opportunityTelemetry: {},
        pickupOpportunity: {
            deps,
            opportunity: boardFeedbackModelState.boardPickupOpportunity
        },
        progressionCues: {
            opportunity: boardFeedbackModelState.boardChainOpportunity,
            sequenceAccessibleLabel: boardFeedbackModelState.boardChainSequenceAccessibleLabel,
            sequenceCue: boardFeedbackModelState.boardChainSequenceCue
        },
        rewardLadder: {
            rewardLadder: boardFeedbackModelState.boardRewardLadderState
        },
        shotMap: {
            label: cardFeedbackState.cardFeedbackShotMapLabel,
            primaryActionId: cardFeedbackState.cardFeedbackPrimaryActionAttr,
            primaryRow: cardFeedbackState.primaryCardActionPriorityRow,
            rows: cardFeedbackState.cardFeedbackShotMapRows,
            summaryAction: cardFeedbackState.cardShotMapSummaryAction,
            summaryBeatCount: cardFeedbackState.cardShotMapSummaryBeatCount,
            summaryScreenCue: cardFeedbackState.cardShotMapSummaryScreenCue,
            summaryTier: cardFeedbackState.cardShotMapSummaryTier
        },
        statusChips: {
            activePower: boardFeedbackModelState.activePowerBoardChip,
            deps,
            traitMode: boardFeedbackModelState.boardTraitModeCue,
            traitModeAccessibleLabel: boardFeedbackModelState.boardTraitModeCueLabel
        },
        statusMeters: {
            deps,
            opportunity: boardFeedbackModelState.boardChainOpportunity,
            rewardLead: boardFeedbackModelState.boardRewardLadderState.lead
        },
        statusTelemetry: {
            activePowerBoardChip: boardFeedbackModelState.activePowerBoardChip,
            boardHazardOpportunity: boardFeedbackModelState.boardHazardOpportunity,
            boardPickupOpportunity: boardFeedbackModelState.boardPickupOpportunity,
            boardTraitModeCue: boardFeedbackModelState.boardTraitModeCue
        }
    });
