import { type CSSProperties } from 'react';
import { type DifficultyProfileRuleSummary } from '../../shared/difficulty-profile';
import { type PerfectMemoryAttribution, type TouchHudDetailRow } from '../../shared/long-run-feedback';
import { PERFECT_MEMORY_BASE_RULES } from '../copy/perfectMemory';
import type { GameplayHudLiveFeedbackStripProps } from './GameplayHudLiveFeedbackStrip';
import type { GameplayHudSecondaryDrawerProps } from './GameplayHudSecondaryDrawer';
import type { GameplayHudTraitRouteDetailsProps } from './GameplayHudTraitRouteDetails';
import type { HudChainAccentFeedbackModel } from './gameplayHudChainAccentFeedbackModels';
import type { HudChainLaneFeedbackModel, HudChainRewardFeedbackModel } from './gameplayHudChainFeedbackModels';
import type { VisualHudAnnouncementImpact } from './gameScreenFeedback';
import type { HudInRunCauseFeedbackModel } from './gameplayHudInRunCauseFeedbackModel';
import type { HudRecentActionFeedbackModel } from './gameplayHudRecentActionFeedbackModel';
import type {
    HudTraitInteractionLaneFeedbackModel,
    HudTraitRouteActionCueModel,
    HudTraitRouteStackCueModel
} from './gameplayHudTraitRouteFeedbackModels';
import type { RunState } from '../../shared/contracts';
import type { TraitOpportunityHudModel, TraitOpportunitySummary } from '../../shared/trait-opportunities';
import type { TraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import type { ChainMilestonePreview, ChainMomentumTier, ChainRewardProgress } from '../copy/chainMomentum';

const hudMeterStyle = (percent: number): CSSProperties =>
    ({
        '--hud-meter-fill': `${Math.max(0, Math.min(100, percent))}%`
    }) as CSSProperties;

export const buildGameplayHudLiveFeedbackStripProps = ({
    chainAccentFeedbackModel,
    chainLaneCue,
    chainMilestonePreview,
    chainMomentumLabel,
    chainMomentumMeterPercent,
    chainMomentumSubline,
    chainMomentumTier,
    chainNextFirstCue,
    chainNextKeepCue,
    chainNextTargetFill,
    chainNextTargetLabel,
    chainNextThenCue,
    chainRewardFeedbackModel,
    chainRewardForecastLabel,
    compactHudAnnouncement,
    currentStreak,
    endlessChapterActive,
    featuredObjectiveStreak,
    inRunCauseFeedbackModel,
    politeHudAnnouncement,
    primaryRewardHot,
    recentActionAriaLabel,
    recentActionFeedbackModel,
    recentActionImpact,
    recentActionLabel,
    recentActionTone,
    reduceMotion,
    rewardProgress,
    runStatus,
    traitInteractionLaneFeedbackModel,
    traitOpportunityHud,
    traitOpportunitySummary,
    traitRouteActionCue,
    traitRouteBestToolLabel,
    traitRouteMeterPercent,
    traitRouteObjectiveStatus,
    traitRouteProgressLabel,
    traitRouteRewardUrgencyTag,
    traitRouteStackCue,
    traitRouteTitle
}: {
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
    chainNextTargetLabel: string;
    chainNextThenCue: string;
    chainRewardFeedbackModel: HudChainRewardFeedbackModel;
    chainRewardForecastLabel: string;
    compactHudAnnouncement: string;
    currentStreak: number;
    endlessChapterActive: boolean;
    featuredObjectiveStreak: number;
    inRunCauseFeedbackModel: HudInRunCauseFeedbackModel;
    politeHudAnnouncement: string;
    primaryRewardHot: boolean;
    recentActionAriaLabel: string | undefined;
    recentActionFeedbackModel: HudRecentActionFeedbackModel;
    recentActionImpact: VisualHudAnnouncementImpact | null;
    recentActionLabel: string;
    recentActionTone: string;
    reduceMotion: boolean;
    rewardProgress: ChainRewardProgress | null;
    runStatus: RunState['status'];
    traitInteractionLaneFeedbackModel: HudTraitInteractionLaneFeedbackModel;
    traitOpportunityHud: TraitOpportunityHudModel;
    traitOpportunitySummary: TraitOpportunitySummary;
    traitRouteActionCue: HudTraitRouteActionCueModel | null;
    traitRouteBestToolLabel: string | null;
    traitRouteMeterPercent: number;
    traitRouteObjectiveStatus: TraitRouteObjectiveStatus | null;
    traitRouteProgressLabel: string;
    traitRouteRewardUrgencyTag: string;
    traitRouteStackCue: HudTraitRouteStackCueModel | null;
    traitRouteTitle: string;
}): GameplayHudLiveFeedbackStripProps => ({
    chainAccentFeedbackModel,
    chainLaneCue,
    chainMilestonePreview,
    chainMomentumLabel,
    chainMomentumMeterPercent,
    chainMomentumSubline,
    chainMomentumTier,
    chainNextFirstCue,
    chainNextKeepCue,
    chainNextTargetFill,
    chainNextTargetLabel,
    chainNextThenCue,
    chainRewardFeedbackModel,
    chainRewardForecastLabel,
    compactHudAnnouncement,
    currentStreak,
    endlessChapterActive,
    featuredObjectiveStreak,
    inRunCauseFeedbackModel,
    politeHudAnnouncement,
    primaryRewardHot,
    recentActionAriaLabel,
    recentActionFeedbackModel,
    recentActionImpact,
    recentActionLabel,
    recentActionTone,
    reduceMotion,
    rewardProgress,
    runStatus,
    traitComboCardCount: traitOpportunitySummary.tiles.length,
    traitInteractionLaneFeedbackModel,
    traitOpportunityActive: traitOpportunityHud.active,
    traitPrimaryLine: traitOpportunityHud.primaryLine,
    traitRouteActionCue,
    traitRouteBestToolLabel,
    traitRouteBuildLabel: traitOpportunityHud.buildLabel,
    traitRouteMeterStyle: traitRouteObjectiveStatus ? hudMeterStyle(traitRouteMeterPercent) : null,
    traitRouteProgressLabel,
    traitRouteStackCue,
    traitRouteTitle,
    traitRouteToolUrgency: traitRouteRewardUrgencyTag
});

export const buildGameplayHudSecondaryDrawerProps = ({
    difficultyProfile,
    perfectMemoryAttribution,
    perfectMemoryHud,
    run,
    touchHudDetailRows,
    traitRouteDetailsProps
}: {
    difficultyProfile: DifficultyProfileRuleSummary;
    perfectMemoryAttribution: PerfectMemoryAttribution;
    perfectMemoryHud: 'hidden' | 'locked' | 'eligible';
    run: RunState;
    touchHudDetailRows: readonly TouchHudDetailRow[];
    traitRouteDetailsProps: GameplayHudTraitRouteDetailsProps | null;
}): GameplayHudSecondaryDrawerProps => ({
    difficultyLabel: difficultyProfile.label,
    difficultyTitle: `${difficultyProfile.label}: ${difficultyProfile.playerCopy}`,
    perfectMemoryLocked: perfectMemoryHud === 'locked',
    perfectMemoryTitle: `${perfectMemoryAttribution.summary} ${PERFECT_MEMORY_BASE_RULES}`,
    perfectMemoryValue:
        perfectMemoryHud === 'hidden'
            ? null
            : perfectMemoryHud === 'locked'
              ? `Locked${perfectMemoryAttribution.firstAction ? `: ${perfectMemoryAttribution.firstAction}` : ''}`
              : 'Eligible',
    run,
    touchHudDetailRows,
    traitRouteDetailsProps
});
