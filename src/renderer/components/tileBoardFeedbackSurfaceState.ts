import { getChainOpportunityBeatActionId } from './tileBoardFeedbackCues';
import {
    buildCardFeedbackTelemetryAttrs,
    buildChainFeedbackTelemetryAttrs,
    buildOpportunityFeedbackTelemetryAttrs,
    buildStatusFeedbackTelemetryAttrs
} from './tileBoardFeedbackTelemetryAttrs';
import {
    buildBoardChainActionPriorityViewData,
    buildBoardChainBeatMapViewData,
    buildBoardChainCadenceMapViewData,
    buildBoardChainMarkerKeyViewData,
    buildBoardChainOpportunityChipViewData,
    buildBoardChainOpportunitySurfaceViewData,
    buildBoardChainProgressionCuesViewData,
    buildBoardChainRewardLadderViewData,
    buildBoardChainShotMapViewData,
    buildBoardChainStatusMetersViewData,
    buildBoardStatusChipsViewData,
    buildFocusedPreviewChipViewData
} from './tileBoardFeedbackViewModels';
import { buildBoardPickupOpportunityChipState } from './tileBoardFeedbackState';
import { buildBoardOpportunitySurfaceState } from './tileBoardOpportunitySurfaceState';

type ChainStatusMetersArgs = Parameters<typeof buildBoardChainStatusMetersViewData>[0];
type OpportunitySurfaceArgs = Parameters<typeof buildBoardOpportunitySurfaceState>[0];
type PickupOpportunityChipArgs = Parameters<typeof buildBoardPickupOpportunityChipState>[0];
type StatusChipsArgs = Parameters<typeof buildBoardStatusChipsViewData>[0];
type ProgressionCuesArgs = Parameters<typeof buildBoardChainProgressionCuesViewData>[0];
type RewardLadderArgs = Parameters<typeof buildBoardChainRewardLadderViewData>[0];
type ShotMapArgs = Parameters<typeof buildBoardChainShotMapViewData>[0];
type ActionPriorityArgs = Parameters<typeof buildBoardChainActionPriorityViewData>[0];
type BeatMapArgs = Parameters<typeof buildBoardChainBeatMapViewData>[0];
type CadenceMapArgs = Parameters<typeof buildBoardChainCadenceMapViewData>[0];
type MarkerKeyArgs = Parameters<typeof buildBoardChainMarkerKeyViewData>[0];
type CardTelemetryArgs = Parameters<typeof buildCardFeedbackTelemetryAttrs>[0];
type ChainTelemetryArgs = Parameters<typeof buildChainFeedbackTelemetryAttrs>[0];
type StatusTelemetryArgs = Parameters<typeof buildStatusFeedbackTelemetryAttrs>[0];
type OpportunityTelemetryArgs = Parameters<typeof buildOpportunityFeedbackTelemetryAttrs>[0];
type FocusedPreviewArgs = Parameters<typeof buildFocusedPreviewChipViewData>[0];
type ChainOpportunityChipArgs = Parameters<typeof buildBoardChainOpportunityChipViewData>[0];
type ChainSurfaceArgs = Parameters<typeof buildBoardChainOpportunitySurfaceViewData>[0];

type OpportunitySurfaceBaseArgs = Omit<OpportunitySurfaceArgs, 'chainHotBandTone'>;
type ProgressionCuesBaseArgs = Omit<
    ProgressionCuesArgs,
    'nextActionTier' | 'nextTargetBeatCount' | 'targetPlanBeatCount'
>;
type RewardLadderBaseArgs = Omit<RewardLadderArgs, 'hotBandTone'>;
type ChainTelemetryBaseArgs = Omit<
    ChainTelemetryArgs,
    'boardChainOpportunityBeatActionId' | 'boardChainStatusMeters'
>;
type StatusTelemetryBaseArgs = Omit<StatusTelemetryArgs, 'boardPickupOpportunityChip'>;
type OpportunityTelemetryBaseArgs = Omit<
    OpportunityTelemetryArgs,
    | 'boardPayoffStack'
    | 'boardBestOpportunity'
    | 'boardBestOpportunityActionId'
    | 'boardBestOpportunityAudio'
    | 'boardBestOpportunityBeatCount'
    | 'boardBestOpportunityHeat'
    | 'boardBestOpportunityImpactCueId'
    | 'boardBestOpportunityScreenCue'
    | 'boardOpportunityCompassRowsLength'
    | 'boardOpportunityCompassSummaryAction'
    | 'boardOpportunityCompassSummaryActionLabel'
    | 'boardOpportunityCompassSummaryBeatCount'
    | 'boardOpportunityCompassSummaryScreenCue'
    | 'boardOpportunityCompassSummaryTier'
    | 'boardOpportunityLaneMapPrimaryView'
    | 'boardOpportunityLaneMapState'
    | 'boardOpportunityLaneMapSummaryAction'
    | 'boardOpportunityLaneMapSummaryBeatCount'
    | 'boardOpportunityLaneMapSummaryScreenCue'
    | 'boardOpportunityLaneMapSummaryTier'
    | 'boardPayoffStackCrescendoAudio'
>;
type ChainOpportunityChipBaseArgs = Omit<ChainOpportunityChipArgs, 'beatActionId'>;
type ChainSurfaceBaseArgs = Omit<
    ChainSurfaceArgs,
    | 'actionPriority'
    | 'arcadeCallout'
    | 'beat'
    | 'beatMap'
    | 'cadenceMap'
    | 'cue'
    | 'eyebrow'
    | 'markerKey'
    | 'meter'
    | 'nextAction'
    | 'primaryShot'
    | 'primaryTraitLane'
    | 'priority'
    | 'progressionCues'
    | 'recipes'
    | 'rewardLadder'
    | 'roleSummaryLanes'
    | 'shotMap'
    | 'statusMeters'
    | 'traitInteractionLaneMap'
    | 'traitLaneBeatMap'
>;

interface BoardFeedbackSurfaceStateArgs {
    actionPriority: ActionPriorityArgs;
    beatMap: BeatMapArgs;
    cadenceMap: CadenceMapArgs;
    cardTelemetry: CardTelemetryArgs;
    chainOpportunityChip: ChainOpportunityChipBaseArgs;
    chainSurface: ChainSurfaceBaseArgs;
    chainTelemetry: ChainTelemetryBaseArgs;
    focusedPreview: FocusedPreviewArgs;
    markerKey: MarkerKeyArgs;
    opportunitySurface: OpportunitySurfaceBaseArgs;
    opportunityTelemetry: OpportunityTelemetryBaseArgs;
    pickupOpportunity: PickupOpportunityChipArgs;
    progressionCues: ProgressionCuesBaseArgs;
    rewardLadder: RewardLadderBaseArgs;
    shotMap: ShotMapArgs;
    statusChips: Omit<StatusChipsArgs, 'pickupOpportunity'>;
    statusMeters: ChainStatusMetersArgs;
    statusTelemetry: StatusTelemetryBaseArgs;
}

export const buildBoardFeedbackSurfaceState = ({
    actionPriority,
    beatMap,
    cadenceMap,
    cardTelemetry,
    chainOpportunityChip,
    chainSurface,
    chainTelemetry,
    focusedPreview,
    markerKey,
    opportunitySurface,
    opportunityTelemetry,
    pickupOpportunity,
    progressionCues,
    rewardLadder,
    shotMap,
    statusChips,
    statusMeters,
    statusTelemetry
}: BoardFeedbackSurfaceStateArgs) => {
    const boardChainOpportunityBeatActionId = getChainOpportunityBeatActionId(
        statusMeters.opportunity.beatSignal
    );
    const {
        hotBandTone: boardChainHotBandTone,
        nextTargetBeatCount: boardChainTargetBeatCount,
        statusMeters: boardChainStatusMeters,
        targetPlanBeatCount: boardChainTargetPlanBeatCount
    } = buildBoardChainStatusMetersViewData(statusMeters);
    const boardOpportunitySurfaceState = buildBoardOpportunitySurfaceState({
        ...opportunitySurface,
        chainHotBandTone: boardChainHotBandTone
    });
    const boardPickupOpportunityChip = buildBoardPickupOpportunityChipState(pickupOpportunity);
    const boardStatusChipsView = buildBoardStatusChipsViewData({
        ...statusChips,
        pickupOpportunity: boardPickupOpportunityChip
    });
    const boardChainProgressionCuesView = buildBoardChainProgressionCuesViewData({
        ...progressionCues,
        nextActionTier: chainOpportunityChip.nextActionTier,
        nextTargetBeatCount: boardChainTargetBeatCount,
        targetPlanBeatCount: boardChainTargetPlanBeatCount
    });
    const boardChainRewardLadderView = buildBoardChainRewardLadderViewData({
        ...rewardLadder,
        hotBandTone: boardChainHotBandTone
    });
    const boardChainShotMapView = buildBoardChainShotMapViewData(shotMap);
    const boardChainActionPriorityView = buildBoardChainActionPriorityViewData(actionPriority);
    const boardChainBeatMapView = buildBoardChainBeatMapViewData(beatMap);
    const boardChainCadenceMapView = buildBoardChainCadenceMapViewData(cadenceMap);
    const boardChainMarkerKeyView = buildBoardChainMarkerKeyViewData(markerKey);
    const cardFeedbackTelemetryAttrs = buildCardFeedbackTelemetryAttrs(cardTelemetry);
    const chainFeedbackTelemetryAttrs = buildChainFeedbackTelemetryAttrs({
        ...chainTelemetry,
        boardChainOpportunityBeatActionId,
        boardChainStatusMeters
    });
    const statusFeedbackTelemetryAttrs = buildStatusFeedbackTelemetryAttrs({
        ...statusTelemetry,
        boardPickupOpportunityChip
    });
    const opportunityFeedbackTelemetryAttrs = buildOpportunityFeedbackTelemetryAttrs({
        ...opportunityTelemetry,
        boardBestOpportunity: boardOpportunitySurfaceState.boardBestOpportunity,
        boardBestOpportunityActionId: boardOpportunitySurfaceState.boardBestOpportunityActionId,
        boardBestOpportunityAudio: boardOpportunitySurfaceState.boardBestOpportunity
            ? opportunitySurface.deps.getAudio(boardOpportunitySurfaceState.boardBestOpportunity)
            : 'none',
        boardBestOpportunityBeatCount: boardOpportunitySurfaceState.boardBestOpportunityBeatCount,
        boardBestOpportunityHeat: boardOpportunitySurfaceState.boardBestOpportunityHeat,
        boardBestOpportunityImpactCueId: boardOpportunitySurfaceState.boardBestOpportunityImpactCueId,
        boardBestOpportunityScreenCue: boardOpportunitySurfaceState.boardBestOpportunity
            ? opportunitySurface.deps.getScreenCue(boardOpportunitySurfaceState.boardBestOpportunity)
            : 'none',
        boardOpportunityCompassRowsLength: boardOpportunitySurfaceState.boardOpportunityCompassRows.length,
        boardOpportunityCompassSummaryAction: boardOpportunitySurfaceState.boardOpportunityCompassSummaryAction,
        boardOpportunityCompassSummaryActionLabel: boardOpportunitySurfaceState.boardOpportunityCompassSummaryActionLabel,
        boardOpportunityCompassSummaryBeatCount: boardOpportunitySurfaceState.boardOpportunityCompassSummaryBeatCount,
        boardOpportunityCompassSummaryScreenCue: boardOpportunitySurfaceState.boardOpportunityCompassSummaryScreenCue,
        boardOpportunityCompassSummaryTier: boardOpportunitySurfaceState.boardOpportunityCompassSummaryTier,
        boardOpportunityLaneMapPrimaryView: boardOpportunitySurfaceState.boardOpportunityLaneMapPrimaryView,
        boardOpportunityLaneMapState: boardOpportunitySurfaceState.boardOpportunityLaneMapState,
        boardOpportunityLaneMapSummaryAction: boardOpportunitySurfaceState.boardOpportunityLaneMapSummaryAction,
        boardOpportunityLaneMapSummaryBeatCount: boardOpportunitySurfaceState.boardOpportunityLaneMapSummaryBeatCount,
        boardOpportunityLaneMapSummaryScreenCue: boardOpportunitySurfaceState.boardOpportunityLaneMapSummaryScreenCue,
        boardOpportunityLaneMapSummaryTier: boardOpportunitySurfaceState.boardOpportunityLaneMapSummaryTier,
        boardPayoffStack: boardOpportunitySurfaceState.boardPayoffStack,
        boardPayoffStackCrescendoAudio: boardOpportunitySurfaceState.boardPayoffStack
            ? opportunitySurface.deps.getCrescendoAudioCue(
                  boardOpportunitySurfaceState.boardPayoffStack.crescendo.tier
              )
            : 'none'
    });
    const focusedPreviewChipView = buildFocusedPreviewChipViewData(focusedPreview);
    const boardChainOpportunityChipView = buildBoardChainOpportunityChipViewData({
        ...chainOpportunityChip,
        beatActionId: boardChainOpportunityBeatActionId
    });
    const boardChainOpportunitySurfaceView = buildBoardChainOpportunitySurfaceViewData({
        ...chainSurface,
        actionPriority: boardChainActionPriorityView,
        arcadeCallout: boardChainOpportunityChipView.arcadeCallout,
        beat: boardChainOpportunityChipView.beat,
        beatMap: boardChainBeatMapView,
        cadenceMap: boardChainCadenceMapView,
        cue: boardChainOpportunityChipView.cue,
        eyebrow: boardChainOpportunityChipView.eyebrow,
        markerKey: boardChainMarkerKeyView,
        meter: boardChainOpportunityChipView.meter,
        nextAction: boardChainOpportunityChipView.nextAction,
        primaryShot: boardChainOpportunityChipView.primaryShot,
        primaryTraitLane: boardChainOpportunityChipView.primaryTraitLane,
        priority: boardChainOpportunityChipView.priority,
        progressionCues: boardChainProgressionCuesView,
        recipes: boardChainOpportunityChipView.recipes,
        rewardLadder: boardChainRewardLadderView,
        roleSummaryLanes: boardChainOpportunityChipView.roleSummaryLanes,
        shotMap: boardChainShotMapView,
        statusMeters: boardChainStatusMeters,
        traitInteractionLaneMap: boardChainOpportunityChipView.traitInteractionLaneMap,
        traitLaneBeatMap: boardChainOpportunityChipView.traitLaneBeatMap
    });

    return {
        ...boardOpportunitySurfaceState,
        boardChainActionPriorityView,
        boardChainBeatMapView,
        boardChainCadenceMapView,
        boardChainMarkerKeyView,
        boardChainOpportunitySurfaceView,
        boardChainProgressionCuesView,
        boardChainRewardLadderView,
        boardChainShotMapView,
        boardStatusChipsView,
        cardFeedbackTelemetryAttrs,
        chainFeedbackTelemetryAttrs,
        focusedPreviewChipView,
        opportunityFeedbackTelemetryAttrs,
        statusFeedbackTelemetryAttrs
    };
};
