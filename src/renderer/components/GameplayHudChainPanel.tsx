import { type CSSProperties } from 'react';
import type {
    ChainMilestonePreview,
    ChainMomentumTier,
    ChainRewardProgress
} from '../copy/chainMomentum';
import type { HudChainLaneFeedbackModel, HudChainRewardFeedbackModel } from './gameplayHudChainFeedbackModels';
import type { HudChainAccentFeedbackModel } from './gameplayHudChainAccentFeedbackModels';
import GameplayHudChainAccentBadges from './GameplayHudChainAccentBadges';
import GameplayHudChainRewardForecast from './GameplayHudChainRewardForecast';
import styles from './GameScreen.module.css';

interface GameplayHudChainPanelProps {
    accentFeedbackModel: HudChainAccentFeedbackModel;
    currentStreak: number;
    forecastLabel: string;
    momentumLabel: string;
    momentumMeterPercent: number;
    momentumSubline: string;
    momentumTier: ChainMomentumTier;
    nextFirstCue: string;
    nextKeepCue: string;
    nextTargetFill: number;
    nextTargetLabel: string;
    nextThenCue: string;
    primaryRewardHot: boolean;
    rewardFeedbackModel: HudChainRewardFeedbackModel;
    rewardProgress: ChainRewardProgress | null;
    milestonePreview: ChainMilestonePreview;
    laneCue: HudChainLaneFeedbackModel;
    reduceMotion: boolean;
}

const GameplayHudChainPanel = ({
    accentFeedbackModel,
    currentStreak,
    forecastLabel,
    momentumLabel,
    momentumMeterPercent,
    momentumSubline,
    momentumTier,
    nextFirstCue,
    nextKeepCue,
    nextTargetFill,
    nextTargetLabel,
    nextThenCue,
    primaryRewardHot,
    rewardFeedbackModel,
    rewardProgress,
    milestonePreview,
    laneCue,
    reduceMotion
}: GameplayHudChainPanelProps) => {
    const milestoneAudioCue = milestonePreview.distance <= 1 ? 'milestone-cashout' : 'milestone-prime';
    const milestoneScreenCue = milestonePreview.distance <= 1 ? 'burst' : 'pulse';

    return (
        <div
            key={`hud-chain-${currentStreak}`}
            aria-label={`Chain lane: ${laneCue.label}. ${laneCue.detail}. Streak x${currentStreak}. ${momentumSubline}. ${nextFirstCue}. ${nextThenCue}. ${nextKeepCue}.`}
            className={`${styles.statPillCompact} ${reduceMotion ? '' : styles.hudChainPill}`}
            data-chain-lane-action={laneCue.action}
            data-chain-lane-audio={laneCue.audioCue}
            data-chain-lane-cue={laneCue.label}
            data-chain-lane-screen-cue={laneCue.screenCue}
            data-chain-lane-tone={laneCue.tone}
            data-chain-milestone-action={milestonePreview.actionLabel}
            data-chain-milestone-audio={milestoneAudioCue}
            data-chain-milestone-screen-cue={milestoneScreenCue}
            data-chain-milestone-target={milestonePreview.target}
            data-chain-milestone-tone={milestonePreview.tone}
            data-chain-tier={momentumTier}
            data-testid="hud-match-chain"
            title="Consecutive matches without a miss - each match adds bonus score on top of the base."
        >
            <span className={styles.statKey}>{momentumLabel}</span>
            <span className={styles.statSubline}>{momentumSubline}</span>
            <span className={styles.statVal}>x{currentStreak}</span>
            <span
                className={styles.hudChainLaneCue}
                data-chain-lane-action={laneCue.action}
                data-chain-lane-audio={laneCue.audioCue}
                data-chain-lane-screen-cue={laneCue.screenCue}
                data-chain-lane-tone={laneCue.tone}
                data-testid="hud-chain-lane-cue"
                title={laneCue.detail}
            >
                {laneCue.label}
            </span>
            <span
                aria-label={`Chain milestone target. ${nextTargetLabel}. ${milestonePreview.actionLabel}. ${nextFirstCue}. ${nextThenCue}. ${nextKeepCue}.`}
                className={styles.hudChainNextTarget}
                data-chain-next-first={nextFirstCue}
                data-chain-next-keep={nextKeepCue}
                data-chain-next-milestone-action={milestonePreview.actionLabel}
                data-chain-next-milestone-audio={milestoneAudioCue}
                data-chain-next-milestone-fill={nextTargetFill}
                data-chain-next-milestone-label={milestonePreview.label}
                data-chain-next-milestone-screen-cue={milestoneScreenCue}
                data-chain-next-milestone-target={milestonePreview.target}
                data-chain-next-milestone-tone={milestonePreview.tone}
                data-chain-next-then={nextThenCue}
                data-testid="hud-chain-next-target"
                style={{ '--chain-next-milestone-fill': `${nextTargetFill}%` } as CSSProperties}
            >
                <strong>{nextTargetLabel}</strong>
                <small>
                    <span>{milestonePreview.actionLabel}</span>
                    <span>{nextFirstCue}</span>
                    <span>{nextThenCue}</span>
                    <span>{nextKeepCue}</span>
                </small>
                <span aria-hidden="true" className={styles.hudChainNextTargetMeter} />
            </span>
            <GameplayHudChainAccentBadges accentFeedbackModel={accentFeedbackModel} />
            <GameplayHudChainRewardForecast
                forecastLabel={forecastLabel}
                primaryRewardHot={primaryRewardHot}
                rewardFeedbackModel={rewardFeedbackModel}
                rewardProgress={rewardProgress}
            />
            <span
                aria-label={`Chain momentum meter ${Math.min(10, Math.max(0, currentStreak))} of 10`}
                className={styles.hudMomentumMeter}
                data-meter-kind="chain"
                data-testid="hud-chain-meter"
                style={{ '--hud-meter-fill': `${Math.max(0, Math.min(100, momentumMeterPercent))}%` } as CSSProperties}
            />
        </div>
    );
};

export default GameplayHudChainPanel;
