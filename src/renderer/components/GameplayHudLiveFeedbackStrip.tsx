import type { CSSProperties } from 'react';
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
import GameplayHudChainPanel from './GameplayHudChainPanel';
import GameplayHudInRunCauseStrip from './GameplayHudInRunCauseStrip';
import GameplayHudRecentAction from './GameplayHudRecentAction';
import GameplayHudTraitRoutePanel from './GameplayHudTraitRoutePanel';
import type { ChainMilestonePreview, ChainMomentumTier, ChainRewardProgress } from '../copy/chainMomentum';
import styles from './GameScreen.module.css';

export interface GameplayHudLiveFeedbackStripProps {
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
    recentActionAriaLabel: string | undefined;
    recentActionFeedbackModel: HudRecentActionFeedbackModel;
    recentActionImpact: VisualHudAnnouncementImpact | null;
    recentActionLabel: string;
    recentActionTone: string;
    reduceMotion: boolean;
    rewardProgress: ChainRewardProgress | null;
    politeHudAnnouncement: string;
    primaryRewardHot: boolean;
    runStatus: string;
    traitComboCardCount: number;
    traitInteractionLaneFeedbackModel: HudTraitInteractionLaneFeedbackModel;
    traitOpportunityActive: boolean;
    traitPrimaryLine: string;
    traitRouteActionCue: HudTraitRouteActionCueModel | null;
    traitRouteBestToolLabel: string | null;
    traitRouteBuildLabel: string;
    traitRouteMeterStyle: CSSProperties | null;
    traitRouteProgressLabel: string;
    traitRouteStackCue: HudTraitRouteStackCueModel | null;
    traitRouteTitle: string;
    traitRouteToolUrgency: string;
}

const GameplayHudLiveFeedbackStrip = ({
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
    recentActionAriaLabel,
    recentActionFeedbackModel,
    recentActionImpact,
    recentActionLabel,
    recentActionTone,
    reduceMotion,
    rewardProgress,
    politeHudAnnouncement,
    primaryRewardHot,
    runStatus,
    traitComboCardCount,
    traitInteractionLaneFeedbackModel,
    traitOpportunityActive,
    traitPrimaryLine,
    traitRouteActionCue,
    traitRouteBestToolLabel,
    traitRouteBuildLabel,
    traitRouteMeterStyle,
    traitRouteProgressLabel,
    traitRouteStackCue,
    traitRouteTitle,
    traitRouteToolUrgency
}: GameplayHudLiveFeedbackStripProps) => (
    <>
        {traitOpportunityActive ? (
            <GameplayHudTraitRoutePanel
                actionCue={traitRouteActionCue}
                bestToolLabel={traitRouteBestToolLabel}
                buildLabel={traitRouteBuildLabel}
                comboCardCount={traitComboCardCount}
                laneFeedbackModel={traitInteractionLaneFeedbackModel}
                meterStyle={traitRouteMeterStyle}
                primaryLine={traitPrimaryLine}
                progressLabel={traitRouteProgressLabel}
                stackCue={traitRouteStackCue}
                title={traitRouteTitle}
                toolUrgency={traitRouteToolUrgency}
            />
        ) : null}
        {runStatus === 'playing' ? (
            <GameplayHudChainPanel
                accentFeedbackModel={chainAccentFeedbackModel}
                currentStreak={currentStreak}
                forecastLabel={chainRewardForecastLabel}
                laneCue={chainLaneCue}
                milestonePreview={chainMilestonePreview}
                momentumLabel={chainMomentumLabel}
                momentumMeterPercent={chainMomentumMeterPercent}
                momentumSubline={chainMomentumSubline}
                momentumTier={chainMomentumTier}
                nextFirstCue={chainNextFirstCue}
                nextKeepCue={chainNextKeepCue}
                nextTargetFill={chainNextTargetFill}
                nextTargetLabel={chainNextTargetLabel}
                nextThenCue={chainNextThenCue}
                primaryRewardHot={primaryRewardHot}
                reduceMotion={reduceMotion}
                rewardFeedbackModel={chainRewardFeedbackModel}
                rewardProgress={rewardProgress}
            />
        ) : null}
        {compactHudAnnouncement ? (
            <GameplayHudRecentAction
                ariaLabel={recentActionAriaLabel}
                compactHudAnnouncement={compactHudAnnouncement}
                feedbackModel={recentActionFeedbackModel}
                impact={recentActionImpact}
                label={recentActionLabel}
                title={politeHudAnnouncement}
                tone={recentActionTone}
            />
        ) : null}
        {inRunCauseFeedbackModel.rows.length > 0 ? (
            <GameplayHudInRunCauseStrip feedbackModel={inRunCauseFeedbackModel} />
        ) : null}
        {endlessChapterActive && featuredObjectiveStreak > 0 ? (
            <div
                className={styles.statPillCompact}
                data-hud-density="tertiary"
                data-testid="hud-featured-streak"
                title="Consecutive endless featured objectives completed"
            >
                <span className={styles.statKey}>Streak</span>
                <span className={styles.statVal}>x{featuredObjectiveStreak}</span>
                <span className={styles.statSubline}>Consecutive featured clears</span>
            </div>
        ) : null}
    </>
);

export default GameplayHudLiveFeedbackStrip;
