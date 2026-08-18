import { type CSSProperties } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import type { HudChainAccentFeedbackModel } from './gameplayHudChainAccentFeedbackModels';
import styles from './GameScreen.module.css';

interface GameplayHudChainAccentBadgesProps {
    accentFeedbackModel: HudChainAccentFeedbackModel;
}

const GameplayHudChainAccentBadges = ({ accentFeedbackModel }: GameplayHudChainAccentBadgesProps) => {
    const rewardHotBadge = accentFeedbackModel.rewardHotBadge;
    const rewardHotBand = accentFeedbackModel.rewardHotBand;
    const comboSurgeBand = accentFeedbackModel.comboSurgeBand;
    const stackedPayoffBadge = accentFeedbackModel.stackedPayoffBadge;

    return (
        <>
            {rewardHotBadge ? (
                <span
                    aria-label={rewardHotBadge.ariaLabel}
                    className={styles.hudChainRewardHotBadge}
                    data-chain-reward-hot-beats={rewardHotBadge.beatCount}
                    data-chain-reward-hot-fill={rewardHotBadge.fill}
                    data-chain-reward-hot-screen-cue={rewardHotBadge.screenCue}
                    data-chain-reward-hot-tone={rewardHotBadge.tone}
                    data-testid="hud-chain-reward-hot"
                    style={{ '--chain-reward-hot-fill': `${rewardHotBadge.fill}%` } as CSSProperties}
                >
                    <small>Reward hot</small>
                    <b>{rewardHotBadge.label}</b>
                    <span aria-hidden="true" className={styles.hudChainRewardHotBadgeMeter} />
                </span>
            ) : null}
            {comboSurgeBand ? (
                <span
                    aria-label={comboSurgeBand.ariaLabel}
                    className={styles.hudChainComboSurgeBand}
                    data-chain-combo-surge-band-beats={comboSurgeBand.beatCount}
                    data-chain-combo-surge-band-screen-cue={comboSurgeBand.screenCue}
                    data-chain-combo-surge-band-tone={comboSurgeBand.tone}
                    data-testid="hud-chain-combo-surge-band"
                >
                    <small>{comboSurgeBand.label}</small>
                    <b>{comboSurgeBand.value}</b>
                    <em>{comboSurgeBand.detail}</em>
                    <i>{comboSurgeBand.cue}</i>
                    <FeedbackBeatPips
                        className={styles.hudChainComboSurgeBandBeatPips}
                        count={comboSurgeBand.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-chain-combo-surge-band-beat': beatIndex + 1,
                            'data-chain-combo-surge-band-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix="chain-combo-surge-band"
                    />
                </span>
            ) : null}
            {rewardHotBand ? (
                <span
                    aria-label={rewardHotBand.ariaLabel}
                    className={styles.hudChainRewardHotBand}
                    data-chain-reward-hot-band-beats={rewardHotBand.beatCount}
                    data-chain-reward-hot-band-screen-cue={rewardHotBand.screenCue}
                    data-chain-reward-hot-band-tone={rewardHotBand.tone}
                    data-testid="hud-chain-reward-hot-band"
                >
                    <small>{rewardHotBand.label}</small>
                    <b>{rewardHotBand.value}</b>
                    <em>{rewardHotBand.detail}</em>
                    <i>{rewardHotBand.chaseLabel}</i>
                    <FeedbackBeatPips
                        className={styles.hudChainRewardHotBandBeatPips}
                        count={rewardHotBand.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-chain-reward-hot-band-beat': beatIndex + 1,
                            'data-chain-reward-hot-band-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix="chain-reward-hot-band"
                    />
                </span>
            ) : null}
            {stackedPayoffBadge ? (
                <span
                    aria-label={stackedPayoffBadge.ariaLabel}
                    className={styles.hudChainStackedPayoffBadge}
                    data-chain-stack-action={stackedPayoffBadge.action}
                    data-chain-stack-beats={stackedPayoffBadge.beatCount}
                    data-chain-stack-fill={stackedPayoffBadge.fill}
                    data-testid="hud-chain-stacked-payoff"
                    style={{ '--chain-stack-fill': `${stackedPayoffBadge.fill}%` } as CSSProperties}
                >
                    <small>{stackedPayoffBadge.count}x payoff</small>
                    <em>{stackedPayoffBadge.action}</em>
                    <b>Next match</b>
                    <span aria-hidden="true" className={styles.hudChainStackedPayoffBadgeMeter} />
                    <FeedbackBeatPips
                        className={styles.hudChainStackedPayoffBadgeBeatPips}
                        count={stackedPayoffBadge.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-chain-stack-beat': beatIndex + 1,
                            'data-chain-stack-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix="chain-stacked-payoff"
                    />
                </span>
            ) : null}
        </>
    );
};

export default GameplayHudChainAccentBadges;
