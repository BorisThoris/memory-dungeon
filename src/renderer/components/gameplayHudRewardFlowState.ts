import { type TraitOpportunityHudModel } from '../../shared/trait-opportunities';
import { type TraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import { type RunState } from '../../shared/contracts';
import {
    type ChainRewardForecastCue,
    type ChainRewardProgress
} from '../copy/chainMomentum';
import type { HudChainAccentFeedbackModel, HudPickupChainStackCueModel } from './gameplayHudChainAccentFeedbackModels';
import type { HudChainLaneFeedbackModel, HudChainRewardFeedbackModel } from './gameplayHudChainFeedbackModels';
import {
    buildGameplayHudChainRewardSummaryState,
    type GameplayHudChainRewardSummaryState
} from './gameplayHudChainRewardSummaryState';
import {
    buildGameplayHudPickupRewardState,
    type GameplayHudPickupRewardState
} from './gameplayHudPickupRewardState';
import {
    buildHudTraitInteractionLaneFeedbackModel,
    buildHudTraitRouteFeedbackModel,
    type HudTraitInteractionLaneFeedbackModel,
    type HudTraitRouteFeedbackModel
} from './gameplayHudTraitRouteFeedbackModels';

export interface GameplayHudRewardFlowState {
    chainAccentFeedbackModel: HudChainAccentFeedbackModel;
    chainComboSurgeBand: HudChainAccentFeedbackModel['comboSurgeBand'];
    chainLaneCue: HudChainLaneFeedbackModel;
    chainMilestonePreview: GameplayHudChainRewardSummaryState['chainMilestonePreview'];
    chainMomentumLabel: string;
    chainMomentumMeterPercent: number;
    chainMomentumSubline: string;
    chainMomentumTier: GameplayHudChainRewardSummaryState['chainMomentumTier'];
    chainNextFirstCue: string;
    chainNextKeepCue: string;
    chainNextTargetFill: number;
    chainNextThenCue: string;
    chainRewardFeedbackModel: HudChainRewardFeedbackModel;
    chainRewardForecastCues: readonly ChainRewardForecastCue[];
    chainRewardForecastLabel: string;
    findableProgressMeterPercent: number;
    findableProgressState: 'live' | 'complete';
    findableProgressSubline: string;
    nextChainTargetLabel: string;
    pickupChainStackCue: HudPickupChainStackCueModel | null;
    pickupProgressTitle: string;
    pickupRewardPreviewLabel: string;
    pickupRewardPreviewRows: GameplayHudPickupRewardState['pickupRewardPreviewRows'];
    primaryChainRewardProgress: ChainRewardProgress | null;
    primaryResourceRewardAction: 'Cash next' | 'Prime cashout' | 'Hold streak' | 'none';
    primaryResourceRewardAudioCue: 'reward-guard' | 'reward-heal' | 'reward-prime' | 'reward-shard' | 'reward-stack';
    primaryResourceRewardBeatCount: number;
    primaryResourceRewardCue: ChainRewardForecastCue | null;
    primaryResourceRewardCueLabel: string | undefined;
    primaryResourceRewardScreenCue: 'burst' | 'pulse' | 'tick';
    primaryRewardHot: boolean;
    stackedChainRewardHot: readonly ChainRewardForecastCue[];
    traitChainStackCue: HudTraitRouteFeedbackModel['stackCue'];
    traitInteractionLaneFeedbackModel: HudTraitInteractionLaneFeedbackModel;
    traitRouteActionCue: HudTraitRouteFeedbackModel['actionCue'];
    traitRouteBestToolLabel: string | null;
    traitRouteMeterPercent: number;
    traitRouteProgressLabel: string;
    traitRouteRewardFeedbackModel: HudTraitRouteFeedbackModel;
}

export const buildGameplayHudRewardFlowState = ({
    run,
    traitOpportunityHud,
    traitOpportunityLaneLines,
    traitRouteObjectiveStatus
}: {
    run: RunState;
    traitOpportunityHud: TraitOpportunityHudModel;
    traitOpportunityLaneLines: readonly string[];
    traitRouteObjectiveStatus: TraitRouteObjectiveStatus | null;
}): GameplayHudRewardFlowState => {
    const chainRewardSummaryState = buildGameplayHudChainRewardSummaryState({
        run,
        traitOpportunityHud
    });
    const traitRouteRewardFeedbackModel = buildHudTraitRouteFeedbackModel({
        primaryRewardHot: chainRewardSummaryState.primaryRewardHot,
        primaryRewardLabel: chainRewardSummaryState.primaryResourceRewardCue?.label ?? null,
        routeCountLabel: traitOpportunityHud.routeCountLabel,
        status: traitRouteObjectiveStatus,
        stackedPayoffCount: chainRewardSummaryState.stackedChainRewardHot.length,
        swapHintActive: Boolean(traitOpportunityHud.swapHint),
        traitOpportunityActive: traitOpportunityHud.active
    });
    const traitRouteActionCue = traitRouteRewardFeedbackModel.actionCue;
    const traitInteractionLaneFeedbackModel = buildHudTraitInteractionLaneFeedbackModel({
        lines: traitOpportunityLaneLines,
        summaryScreenCue: traitRouteActionCue?.screenCue ?? 'tick'
    });
    const pickupRewardState = buildGameplayHudPickupRewardState({
        claimedFindables: run.findablesClaimedThisFloor,
        primaryRewardHot: chainRewardSummaryState.primaryRewardHot,
        primaryRewardLabel: chainRewardSummaryState.primaryResourceRewardCue?.label ?? null,
        stackedPayoffCount: chainRewardSummaryState.stackedChainRewardHot.length,
        totalFindables: run.findablesTotalThisFloor
    });

    return {
        ...chainRewardSummaryState,
        chainComboSurgeBand: chainRewardSummaryState.chainAccentFeedbackModel.comboSurgeBand,
        ...pickupRewardState,
        traitChainStackCue: traitRouteRewardFeedbackModel.stackCue,
        traitInteractionLaneFeedbackModel,
        traitRouteActionCue,
        traitRouteBestToolLabel: traitRouteRewardFeedbackModel.bestToolLabel,
        traitRouteMeterPercent: traitRouteRewardFeedbackModel.meterPercent,
        traitRouteProgressLabel: traitRouteRewardFeedbackModel.progressLabel,
        traitRouteRewardFeedbackModel
    };
};
