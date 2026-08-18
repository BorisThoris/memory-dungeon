import { type CSSProperties } from 'react';
import type { ChainRewardProgress } from '../copy/chainMomentum';
import type { HudChainRewardFeedbackModel } from './gameplayHudChainFeedbackModels';
import GameplayHudChainRewardCueList from './GameplayHudChainRewardCueList';
import GameplayHudChainRewardLadder from './GameplayHudChainRewardLadder';
import GameplayHudChainRewardLaneMap from './GameplayHudChainRewardLaneMap';
import styles from './GameScreen.module.css';

interface GameplayHudChainRewardForecastProps {
    forecastLabel: string;
    primaryRewardHot: boolean;
    rewardFeedbackModel: HudChainRewardFeedbackModel;
    rewardProgress: ChainRewardProgress | null;
}

const GameplayHudChainRewardForecast = ({
    forecastLabel,
    primaryRewardHot,
    rewardFeedbackModel,
    rewardProgress
}: GameplayHudChainRewardForecastProps) => {
    const leadCue = rewardFeedbackModel.leadCue;
    const laneRows = rewardFeedbackModel.laneRows;
    const primaryLane = rewardFeedbackModel.primaryLane;
    const ladderRows = rewardFeedbackModel.ladderRows;
    const forecastRows = rewardFeedbackModel.forecastRows;
    const forecastCueCount = laneRows.length + ladderRows.length;

    if (forecastRows.length === 0) {
        return null;
    }

    return (
        <>
            {rewardProgress ? (
                <span
                    aria-label={`Chain reward progress ${rewardProgress.label} toward ${rewardProgress.targetLabel}. ${rewardProgress.remainingLabel}.`}
                    className={styles.hudChainRewardPips}
                    data-chain-reward-progress={rewardProgress.label}
                    data-testid="hud-chain-reward-pips"
                >
                    {Array.from({ length: rewardProgress.total }, (_, index) => (
                        <span
                            aria-hidden="true"
                            data-pip-filled={index < rewardProgress.filled ? 'true' : 'false'}
                            key={`${rewardProgress.targetLabel}:${index}`}
                        />
                    ))}
                    <b>{rewardProgress.remainingLabel}</b>
                </span>
            ) : null}
            <span
                aria-label={forecastLabel}
                className={styles.hudChainRewardForecast}
                data-chain-reward-forecast-hot={primaryRewardHot ? 'true' : 'false'}
                data-chain-reward-lane-actions={rewardFeedbackModel.laneActionMapAttr}
                data-chain-reward-lane-map={rewardFeedbackModel.laneMapAttr}
                data-testid="hud-chain-reward-forecast"
            >
                <span
                    aria-label={`Chain reward forecast summary. ${forecastCueCount} ${forecastCueCount === 1 ? 'cue' : 'cues'}.`}
                    className={styles.hudChainRewardForecastSummary}
                    data-chain-reward-forecast-summary-fill={rewardFeedbackModel.summaryFill}
                    data-chain-reward-forecast-summary-screen-cue={leadCue?.screenCue ?? 'none'}
                    data-chain-reward-forecast-summary-tone={leadCue?.tone ?? 'none'}
                    data-chain-reward-forecast-summary-urgency={leadCue?.urgency ?? 'none'}
                    data-chain-reward-ladder-count={ladderRows.length}
                    data-chain-reward-lane-count={laneRows.length}
                    data-testid="hud-chain-reward-forecast-summary"
                    style={
                        {
                            '--chain-reward-forecast-summary-fill': `${rewardFeedbackModel.summaryFill}%`
                        } as CSSProperties
                    }
                >
                    <small>Forecast</small>
                    <b>
                        {forecastCueCount} {forecastCueCount === 1 ? 'cue' : 'cues'}
                    </b>
                    <span aria-hidden="true" className={styles.hudChainRewardForecastSummaryBeatPips}>
                        {Array.from({ length: Math.max(2, Math.min(5, forecastCueCount)) }, (_, beatIndex) => (
                            <i
                                data-chain-reward-forecast-summary-beat={beatIndex + 1}
                                data-chain-reward-forecast-summary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                data-chain-reward-forecast-summary-beat-screen-cue={leadCue?.screenCue ?? 'none'}
                                data-chain-reward-forecast-summary-beat-tone={leadCue?.tone ?? 'none'}
                                data-chain-reward-forecast-summary-beat-urgency={leadCue?.urgency ?? 'none'}
                                key={beatIndex}
                            />
                        ))}
                    </span>
                    <span aria-hidden="true" className={styles.hudChainRewardForecastSummaryMeter} />
                </span>
                {leadCue ? (
                    <span
                        aria-label={`Next chain reward. ${leadCue.chaseLabel}. ${leadCue.laneAction}. ${leadCue.label}. ${leadCue.urgencyCopy}.${leadCue.stackLabel ? ` ${leadCue.stackLabel}.` : ''}`}
                        data-chain-reward-lead-action={leadCue.laneAction}
                        data-chain-reward-lead-audio={leadCue.audioCue}
                        data-chain-reward-lead-screen-cue={leadCue.screenCue}
                        data-chain-reward-lead-stack-size={leadCue.stackSize ?? 1}
                        data-chain-reward-lead-tone={leadCue.tone}
                        data-testid="hud-chain-reward-lead"
                    >
                        <small>Next reward</small>
                        <strong>{leadCue.chaseLabel}</strong>
                        <b>{leadCue.laneAction}</b>
                        <em>{leadCue.label}</em>
                        <small>{leadCue.urgencyCopy}</small>
                        {leadCue.stackLabel ? <i>{leadCue.stackLabel}</i> : null}
                    </span>
                ) : null}
                <GameplayHudChainRewardLaneMap
                    laneActionMapAttr={rewardFeedbackModel.laneActionMapAttr}
                    laneMapAttr={rewardFeedbackModel.laneMapAttr}
                    laneMapLabel={rewardFeedbackModel.laneMapLabel}
                    laneRows={laneRows}
                    primaryLane={primaryLane}
                />
                <GameplayHudChainRewardLadder
                    ladderActionAttr={rewardFeedbackModel.ladderActionAttr}
                    ladderAttr={rewardFeedbackModel.ladderAttr}
                    ladderLabel={rewardFeedbackModel.ladderLabel}
                    ladderRows={ladderRows}
                />
                <GameplayHudChainRewardCueList forecastRows={forecastRows} />
            </span>
        </>
    );
};

export default GameplayHudChainRewardForecast;
