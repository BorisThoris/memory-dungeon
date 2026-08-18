import type { HudChainRewardLaneRow } from './gameplayHudChainFeedbackModels';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './GameScreen.module.css';

interface GameplayHudChainRewardLaneMapProps {
    laneActionMapAttr: string;
    laneMapAttr: string;
    laneMapLabel: string;
    laneRows: HudChainRewardLaneRow[];
    primaryLane: HudChainRewardLaneRow | null;
}

const GameplayHudChainRewardLaneMap = ({
    laneActionMapAttr,
    laneMapAttr,
    laneMapLabel,
    laneRows,
    primaryLane
}: GameplayHudChainRewardLaneMapProps) => {
    if (laneRows.length <= 1) {
        return null;
    }

    return (
        <span
            aria-label={laneMapLabel}
            data-chain-reward-lane-actions={laneActionMapAttr}
            data-chain-reward-lane-map={laneMapAttr}
            data-chain-reward-primary-lane={primaryLane?.id ?? 'none'}
            data-chain-reward-primary-lane-action={primaryLane?.action ?? 'none'}
            data-chain-reward-primary-lane-audio={primaryLane?.audioCue ?? 'none'}
            data-chain-reward-primary-lane-beats={primaryLane?.beatCount ?? 0}
            data-chain-reward-primary-lane-cue={primaryLane?.cue ?? 'none'}
            data-chain-reward-primary-lane-cue-id={primaryLane?.cueBadge.id ?? 'none'}
            data-chain-reward-primary-lane-screen-cue={primaryLane?.screenCue ?? 'none'}
            data-testid="hud-chain-reward-lane-map"
        >
            {primaryLane ? (
                <u
                    aria-label={`Primary chain reward lane. ${primaryLane.label}. ${primaryLane.cueBadge.label} cue ${primaryLane.cueBadge.glyph}. ${primaryLane.roleLabel}. ${primaryLane.action}. ${primaryLane.cue}. ${primaryLane.beatCount} beats.`}
                    className={styles.hudChainRewardPrimaryLaneCue}
                    data-chain-reward-primary-lane={primaryLane.id}
                    data-chain-reward-primary-lane-action={primaryLane.action}
                    data-chain-reward-primary-lane-audio={primaryLane.audioCue}
                    data-chain-reward-primary-lane-beats={primaryLane.beatCount}
                    data-chain-reward-primary-lane-cue={primaryLane.cue}
                    data-chain-reward-primary-lane-cue-id={primaryLane.cueBadge.id}
                    data-chain-reward-primary-lane-screen-cue={primaryLane.screenCue}
                    data-testid="hud-chain-reward-primary-lane"
                >
                    <small>Cash lane</small>
                    <strong aria-hidden="true">{primaryLane.cueBadge.glyph}</strong>
                    <b>{`${primaryLane.roleLabel} / ${primaryLane.action}`}</b>
                    <em>{`${primaryLane.cueBadge.label} cue / ${primaryLane.label} / ${primaryLane.cue}`}</em>
                    <FeedbackBeatPips
                        className={styles.hudChainRewardPrimaryLaneBeatPips}
                        count={primaryLane.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-chain-reward-primary-lane-beat': beatIndex + 1,
                            'data-chain-reward-primary-lane-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`chain-reward-primary-lane-${primaryLane.id}`}
                    />
                </u>
            ) : null}
            {laneRows.map((lane) => (
                <u
                    aria-label={lane.ariaLabel}
                    data-chain-reward-lane={lane.id}
                    data-chain-reward-lane-action={lane.action}
                    data-chain-reward-lane-audio={lane.audioCue}
                    data-chain-reward-lane-beats={lane.beatCount}
                    data-chain-reward-lane-count={lane.count}
                    data-chain-reward-lane-cue-id={lane.cueBadge.id}
                    data-chain-reward-lane-screen-cue={lane.screenCue}
                    key={lane.id}
                >
                    <small>{lane.label}</small>
                    <strong aria-hidden="true">{lane.cueBadge.glyph}</strong>
                    <b>{`${lane.roleLabel} / ${lane.action}`}</b>
                    <em>{`${lane.cueBadge.label} cue / x${lane.count} / ${lane.cue}`}</em>
                    <FeedbackBeatPips
                        className={styles.hudChainRewardLaneBeatPips}
                        count={lane.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-chain-reward-lane-beat': beatIndex + 1,
                            'data-chain-reward-lane-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`chain-reward-lane-${lane.id}`}
                    />
                </u>
            ))}
        </span>
    );
};

export default GameplayHudChainRewardLaneMap;
