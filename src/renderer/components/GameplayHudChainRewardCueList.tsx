import type { HudChainRewardForecastRow } from './gameplayHudChainFeedbackModels';
import styles from './GameScreen.module.css';

interface GameplayHudChainRewardCueListProps {
    forecastRows: HudChainRewardForecastRow[];
}

const GameplayHudChainRewardCueList = ({ forecastRows }: GameplayHudChainRewardCueListProps) => (
    <>
        {forecastRows.map((cue) => (
            <span
                aria-label={cue.ariaLabel}
                data-chain-reward-arcade-cue={cue.urgencyCopy}
                data-chain-reward-audio={cue.audioCue}
                data-chain-reward-cue-id={cue.cueBadge.id}
                data-chain-reward-distance={cue.distance}
                data-chain-reward-lane-action={cue.laneAction}
                data-chain-reward-screen-cue={cue.screenCue}
                data-chain-reward-stack-size={cue.stackSize ?? 1}
                data-chain-reward-tone={cue.tone}
                data-chain-reward-urgency={cue.urgency}
                key={cue.id}
            >
                <strong aria-hidden="true">{cue.cueBadge.glyph}</strong>
                <small>{cue.actionLabel}</small>
                <u>{cue.chaseLabel}</u>
                <b>{`${cue.laneAction} / ${cue.label}`}</b>
                <em>{cue.distanceLabel}</em>
                <i>{`${cue.cueBadge.label} cue / ${cue.urgencyCopy}`}</i>
                {cue.stackLabel ? (
                    <>
                        <mark>{cue.stackLabel}</mark>
                        <span aria-hidden="true" className={styles.hudChainRewardForecastStackPips}>
                            {Array.from({ length: cue.stackSize ?? 1 }, (_, beatIndex) => (
                                <i
                                    data-chain-reward-forecast-stack-beat={beatIndex + 1}
                                    data-chain-reward-forecast-stack-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={`${cue.id}-forecast-stack-${beatIndex + 1}`}
                                />
                            ))}
                        </span>
                    </>
                ) : null}
            </span>
        ))}
    </>
);

export default GameplayHudChainRewardCueList;
