import {
    buildBoardOpportunityLaneMapState,
    buildBoardPayoffStackState
} from './tileBoardFeedbackState';
import {
    buildBoardOpportunityCompassSurfaceViewData,
    buildBoardOpportunityCompassViewData,
    buildBoardOpportunityLaneMapSurfaceViewData,
    buildBoardOpportunityLaneMapViewData
} from './tileBoardFeedbackViewModels';

interface OpportunityCompassRowLike {
    action: string;
    detail: string;
    id: 'chain' | 'hazard' | 'perk' | 'pickup' | 'recovery' | 'tool' | 'trait';
    impactCue: string;
    label: string;
    tone: string;
    value: string;
}

interface HazardOpportunityLike {
    action: string;
    family: string;
    screenCue: string;
    tier: string;
    trigger: string;
}

interface OpportunitySurfaceDeps {
    getActionId: (row: OpportunityCompassRowLike | null) => string | null;
    getAudio: (row: OpportunityCompassRowLike) => string;
    getBeatCount: (row: OpportunityCompassRowLike) => number;
    getCrescendoAudioCue: (tier: string) => string;
    getHeat: (impactCue: string) => string;
    getImpactCueId: (impactCue: string) => string | null;
    getScreenCue: (row: OpportunityCompassRowLike) => string;
    getSummaryAction: (row: OpportunityCompassRowLike | null) => string | null;
    getSummaryTier: (row: OpportunityCompassRowLike | null) => string | null;
}

export const buildBoardOpportunitySurfaceState = ({
    chainHotBandTone,
    chainOpportunity,
    deps,
    hazardOpportunity,
    rows
}: {
    chainHotBandTone: string;
    chainOpportunity: { comboSurgeLabel: string | null };
    deps: OpportunitySurfaceDeps;
    hazardOpportunity: HazardOpportunityLike | null;
    rows: OpportunityCompassRowLike[];
}) => {
    const boardOpportunityLaneMapState = buildBoardOpportunityLaneMapState({ rows });
    const {
        liveText: boardOpportunityLaneMapLiveText,
        meterFill: boardOpportunityLaneMapMeterFill,
        primaryView: boardOpportunityLaneMapPrimaryView,
        rowViews: boardOpportunityLaneMapRowViews,
        summaryAction: boardOpportunityLaneMapSummaryAction,
        summaryBeatCount: boardOpportunityLaneMapSummaryBeatCount,
        summaryScreenCue: boardOpportunityLaneMapSummaryScreenCue,
        summaryTier: boardOpportunityLaneMapSummaryTier
    } = buildBoardOpportunityLaneMapViewData({
        primaryLane: boardOpportunityLaneMapState.primaryLane,
        rows: boardOpportunityLaneMapState.rows
    });
    const boardPayoffStackState = buildBoardPayoffStackState({ rows });
    const boardPayoffStack = boardPayoffStackState.stack;
    const boardPayoffStackFill = boardPayoffStackState.fill;
    const boardBestOpportunity = rows[0] ?? null;
    const {
        bestOpportunityActionId: boardBestOpportunityActionId,
        bestOpportunityBeatCount: boardBestOpportunityBeatCount,
        bestOpportunityHeat: boardBestOpportunityHeat,
        bestOpportunityImpactCueId: boardBestOpportunityImpactCueId,
        compassLabel: boardOpportunityCompassLabel,
        meterFill: boardOpportunityCompassMeterFill,
        payoffStackView: boardPayoffStackView,
        rowViews: boardOpportunityCompassRowViews,
        summaryAction: boardOpportunityCompassSummaryAction,
        summaryActionLabel: boardOpportunityCompassSummaryActionLabel,
        summaryBeatCount: boardOpportunityCompassSummaryBeatCount,
        summaryScreenCue: boardOpportunityCompassSummaryScreenCue,
        summaryTier: boardOpportunityCompassSummaryTier
    } = buildBoardOpportunityCompassViewData({
        deps,
        hazardOpportunity,
        laneMapAccessibleLabel: boardOpportunityLaneMapState.accessibleLabel,
        laneMapRows: boardOpportunityLaneMapState.rows,
        payoffStack: boardPayoffStack,
        payoffStackFill: boardPayoffStackFill,
        rows
    });

    return {
        boardBestOpportunity,
        boardBestOpportunityActionId,
        boardBestOpportunityBeatCount,
        boardBestOpportunityHeat,
        boardBestOpportunityImpactCueId,
        boardOpportunityCompassLabel,
        boardOpportunityCompassMeterFill,
        boardOpportunityCompassRowViews,
        boardOpportunityCompassRows: rows,
        boardOpportunityCompassSummaryAction,
        boardOpportunityCompassSummaryActionLabel,
        boardOpportunityCompassSummaryBeatCount,
        boardOpportunityCompassSummaryScreenCue,
        boardOpportunityCompassSummaryTier,
        boardOpportunityCompassView: buildBoardOpportunityCompassSurfaceViewData({
            bestOpportunity: boardBestOpportunity,
            chainOpportunity,
            compassLabel: boardOpportunityCompassLabel,
            heat: boardBestOpportunityHeat,
            hotBandTone: chainHotBandTone,
            meterFill: boardOpportunityCompassMeterFill,
            payoffStack: boardPayoffStackView,
            rows: boardOpportunityCompassRowViews,
            summaryAction: boardOpportunityCompassSummaryAction,
            summaryActionLabel: boardOpportunityCompassSummaryActionLabel,
            summaryBeatCount: boardOpportunityCompassSummaryBeatCount,
            summaryScreenCue: boardOpportunityCompassSummaryScreenCue,
            summaryTier: boardOpportunityCompassSummaryTier
        }),
        boardOpportunityLaneMapLiveText,
        boardOpportunityLaneMapMeterFill,
        boardOpportunityLaneMapPrimaryView,
        boardOpportunityLaneMapRowViews,
        boardOpportunityLaneMapState,
        boardOpportunityLaneMapSummaryAction,
        boardOpportunityLaneMapSummaryBeatCount,
        boardOpportunityLaneMapSummaryScreenCue,
        boardOpportunityLaneMapSummaryTier,
        boardOpportunityLaneMapView: buildBoardOpportunityLaneMapSurfaceViewData({
            accessibleLabel: boardOpportunityLaneMapState.accessibleLabel,
            actionIdMap: boardOpportunityLaneMapState.actionIdAttr,
            actionMap: boardOpportunityLaneMapState.actionAttr,
            laneMap: boardOpportunityLaneMapState.attr,
            primaryLane: boardOpportunityLaneMapPrimaryView,
            roleIdMap: boardOpportunityLaneMapState.roleIdAttr,
            roleMap: boardOpportunityLaneMapState.roleAttr,
            rows: boardOpportunityLaneMapRowViews,
            summaryAction: boardOpportunityLaneMapSummaryAction,
            summaryBeatCount: boardOpportunityLaneMapSummaryBeatCount,
            summaryMeterFill: boardOpportunityLaneMapMeterFill,
            summaryScreenCue: boardOpportunityLaneMapSummaryScreenCue,
            summaryTier: boardOpportunityLaneMapSummaryTier
        }),
        boardPayoffStack
    };
};
