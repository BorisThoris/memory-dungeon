import { type RunState } from '../../shared/contracts';
import { type TraitOpportunityHudModel } from '../../shared/trait-opportunities';
import {
    getChainMilestonePreview,
    getChainMomentumLabel,
    getChainMomentumSubline,
    getChainMomentumTier,
    getChainRewardForecastCues,
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardUrgencyCopy,
    type ChainMilestonePreview,
    type ChainMomentumTier,
    type ChainRewardForecastCue,
    type ChainRewardProgress
} from '../copy/chainMomentum';
import {
    buildHudChainAccentFeedbackModel,
    type HudChainAccentFeedbackModel
} from './gameplayHudChainAccentFeedbackModels';
import {
    buildHudChainLaneFeedbackModel,
    buildHudChainRewardFeedbackModel,
    getHudPrimaryRewardAudioCue as hudPrimaryRewardAudioCue,
    getHudPrimaryRewardBeatCount as hudPrimaryRewardBeatCount,
    getHudPrimaryRewardScreenCue as hudPrimaryRewardScreenCue,
    type HudChainLaneFeedbackModel,
    type HudChainRewardFeedbackModel
} from './gameplayHudChainFeedbackModels';

const formatRewardPreviewLabel = (
    label: string,
    rows: readonly { actionLabel?: string; chaseLabel?: string; distanceLabel?: string; label?: string; rewardText?: string }[]
): string => {
    const rowCopy = rows
        .map((row) =>
            [row.chaseLabel, row.actionLabel, row.rewardText ?? row.label, row.distanceLabel]
                .filter(Boolean)
                .join(': ')
        )
        .filter(Boolean)
        .join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

export interface GameplayHudChainRewardSummaryState {
    chainAccentFeedbackModel: HudChainAccentFeedbackModel;
    chainLaneCue: HudChainLaneFeedbackModel;
    chainMilestonePreview: ChainMilestonePreview;
    chainMomentumLabel: string;
    chainMomentumMeterPercent: number;
    chainMomentumSubline: string;
    chainMomentumTier: ChainMomentumTier;
    chainNextFirstCue: string;
    chainNextKeepCue: string;
    chainNextTargetFill: number;
    chainNextThenCue: string;
    chainRewardFeedbackModel: HudChainRewardFeedbackModel;
    chainRewardForecastCues: readonly ChainRewardForecastCue[];
    chainRewardForecastLabel: string;
    nextChainTargetLabel: string;
    primaryChainRewardProgress: ChainRewardProgress | null;
    primaryResourceRewardAction: 'Cash next' | 'Prime cashout' | 'Hold streak' | 'none';
    primaryResourceRewardAudioCue: 'reward-guard' | 'reward-heal' | 'reward-prime' | 'reward-shard' | 'reward-stack';
    primaryResourceRewardBeatCount: number;
    primaryResourceRewardCue: ChainRewardForecastCue | null;
    primaryResourceRewardCueLabel: string | undefined;
    primaryResourceRewardScreenCue: 'burst' | 'pulse' | 'tick';
    primaryRewardHot: boolean;
    stackedChainRewardHot: readonly ChainRewardForecastCue[];
}

export const buildGameplayHudChainRewardSummaryState = ({
    run,
    traitOpportunityHud
}: {
    run: RunState;
    traitOpportunityHud: TraitOpportunityHudModel;
}): GameplayHudChainRewardSummaryState => {
    const chainMomentumTier = getChainMomentumTier(run.stats.currentStreak);
    const chainMomentumLabel = getChainMomentumLabel(chainMomentumTier);
    const chainMomentumSubline = getChainMomentumSubline(run.stats.currentStreak, traitOpportunityHud.active);
    const chainMomentumMeterPercent = Math.min(100, (Math.max(0, run.stats.currentStreak) / 10) * 100);
    const chainMilestonePreview = getChainMilestonePreview(run.stats.currentStreak);
    const nextChainTargetLabel =
        chainMilestonePreview.distance <= 0
            ? chainMilestonePreview.distanceLabel
            : `${chainMilestonePreview.distanceLabel} to ${chainMilestonePreview.target}`;
    const chainRewardForecastCues = getChainRewardForecastCues(
        run.stats.currentStreak,
        run.stats.comboShards,
        run.lives
    );
    const primaryResourceRewardCue = chainRewardForecastCues[0] ?? null;
    const primaryResourceRewardBeatCount = primaryResourceRewardCue
        ? hudPrimaryRewardBeatCount(primaryResourceRewardCue)
        : 0;
    const primaryResourceRewardAction = primaryResourceRewardCue
        ? getChainRewardLaneAction(primaryResourceRewardCue.urgency)
        : 'none';
    const primaryResourceRewardAudioCue = primaryResourceRewardCue
        ? hudPrimaryRewardAudioCue(primaryResourceRewardCue)
        : 'reward-prime';
    const primaryResourceRewardScreenCue = primaryResourceRewardCue
        ? hudPrimaryRewardScreenCue(primaryResourceRewardCue)
        : 'tick';
    const primaryRewardHot = primaryResourceRewardCue?.urgency === 'next';
    const nearestRewardDistance = primaryResourceRewardCue?.distance ?? null;
    const stackedChainRewardCues =
        nearestRewardDistance != null
            ? chainRewardForecastCues.filter((cue) => cue.distance === nearestRewardDistance)
            : [];
    const stackedChainRewardHot =
        primaryRewardHot && stackedChainRewardCues.length >= 2 ? stackedChainRewardCues : [];
    const chainLaneCue = buildHudChainLaneFeedbackModel({
        primaryRewardHot,
        primaryRewardLabel: primaryResourceRewardCue?.label ?? null,
        stackedPayoffCount: stackedChainRewardHot.length,
        streak: run.stats.currentStreak,
        traitRouteActive: traitOpportunityHud.active
    });
    const chainNextTargetFill =
        chainMilestonePreview.distance <= 0
            ? 100
            : Math.min(100, (run.stats.currentStreak / (run.stats.currentStreak + chainMilestonePreview.distance)) * 100);
    const primaryChainRewardProgress = getChainRewardProgress(run.stats.currentStreak, primaryResourceRewardCue);
    const chainAccentFeedbackModel = buildHudChainAccentFeedbackModel({
        buildLabel: traitOpportunityHud.buildLabel,
        chainLaneLabel: chainLaneCue.label,
        currentStreak: run.stats.currentStreak,
        forecastCueCount: chainRewardForecastCues.length,
        nextChainTargetLabel,
        primaryRewardBeatCount: primaryResourceRewardBeatCount,
        primaryRewardChaseLabel: primaryResourceRewardCue?.chaseLabel ?? null,
        primaryRewardHot,
        primaryRewardLabel: primaryResourceRewardCue?.label ?? null,
        primaryRewardProgressFilled: primaryChainRewardProgress?.filled ?? null,
        primaryRewardProgressRemainingLabel: primaryChainRewardProgress?.remainingLabel ?? null,
        primaryRewardProgressTotal: primaryChainRewardProgress?.total ?? null,
        routeCountLabel: traitOpportunityHud.routeCountLabel,
        stackedPayoffLabels: stackedChainRewardHot.map((cue) => cue.label),
        traitOpportunityActive: traitOpportunityHud.active,
        traitPrimaryLine: traitOpportunityHud.primaryLine
    });
    const primaryResourceRewardCueLabel = primaryResourceRewardCue
        ? formatRewardPreviewLabel('Nearest chain reward', [
              {
                  ...primaryResourceRewardCue,
                  rewardText: `${getChainRewardLaneAction(primaryResourceRewardCue.urgency)}: ${getChainRewardUrgencyCopy(primaryResourceRewardCue)}: ${primaryResourceRewardCue.label}`
              }
          ])
        : undefined;
    const chainRewardFeedbackModel = buildHudChainRewardFeedbackModel(chainRewardForecastCues, run.stats.currentStreak);

    return {
        chainAccentFeedbackModel,
        chainLaneCue,
        chainMilestonePreview,
        chainMomentumLabel,
        chainMomentumMeterPercent,
        chainMomentumSubline,
        chainMomentumTier,
        chainNextFirstCue: chainAccentFeedbackModel.nextFirstCue,
        chainNextKeepCue: chainAccentFeedbackModel.nextKeepCue,
        chainNextTargetFill,
        chainNextThenCue: chainAccentFeedbackModel.nextThenCue,
        chainRewardFeedbackModel,
        chainRewardForecastCues,
        chainRewardForecastLabel: formatRewardPreviewLabel('Chain reward forecast', chainRewardFeedbackModel.forecastRows),
        nextChainTargetLabel,
        primaryChainRewardProgress,
        primaryResourceRewardAction,
        primaryResourceRewardAudioCue,
        primaryResourceRewardBeatCount,
        primaryResourceRewardCue,
        primaryResourceRewardCueLabel,
        primaryResourceRewardScreenCue,
        primaryRewardHot,
        stackedChainRewardHot
    };
};
