import { type CSSProperties } from 'react';
import type { HudChainRewardLadderRow } from './gameplayHudChainFeedbackModels';
import styles from './GameScreen.module.css';

interface GameplayHudChainRewardLadderProps {
    ladderActionAttr: string;
    ladderAttr: string;
    ladderLabel: string;
    ladderRows: HudChainRewardLadderRow[];
}

const GameplayHudChainRewardLadder = ({
    ladderActionAttr,
    ladderAttr,
    ladderLabel,
    ladderRows
}: GameplayHudChainRewardLadderProps) => {
    if (ladderRows.length <= 1) {
        return null;
    }

    return (
        <span
            aria-label={ladderLabel}
            data-chain-reward-ladder={ladderAttr}
            data-chain-reward-ladder-actions={ladderActionAttr}
            data-testid="hud-chain-reward-ladder"
        >
            {ladderRows.map((entry) => (
                <u
                    aria-label={entry.ariaLabel}
                    data-chain-reward-ladder-action={entry.action}
                    data-chain-reward-ladder-audio={entry.audioCue}
                    data-chain-reward-ladder-beats={entry.beatCount}
                    data-chain-reward-ladder-cue-id={entry.cueBadge.id}
                    data-chain-reward-ladder-filled={entry.filled}
                    data-chain-reward-ladder-screen-cue={entry.screenCue}
                    data-chain-reward-ladder-tone={entry.cue.tone}
                    data-chain-reward-ladder-total={entry.total}
                    data-chain-reward-ladder-urgency={entry.cue.urgency}
                    key={entry.cue.id}
                    style={
                        {
                            '--chain-reward-ladder-fill': `${Math.round((entry.filled / entry.total) * 100)}%`
                        } as CSSProperties
                    }
                >
                    <small>{entry.cue.chaseLabel}</small>
                    <strong aria-hidden="true">{entry.cueBadge.glyph}</strong>
                    <b>{entry.rewardLabel}</b>
                    <em>{entry.progressLabel}</em>
                    <i>{`${entry.cueBadge.label} cue / ${entry.remainingLabel}`}</i>
                    {entry.stackSize > 1 ? (
                        <span aria-hidden="true" className={styles.hudChainRewardLadderStackPips}>
                            {Array.from({ length: entry.stackSize }, (_, beatIndex) => (
                                <i
                                    data-chain-reward-ladder-stack-beat={beatIndex + 1}
                                    data-chain-reward-ladder-stack-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                    key={`${entry.cue.id}-stack-${beatIndex + 1}`}
                                />
                            ))}
                        </span>
                    ) : null}
                    <span aria-hidden="true" className={styles.hudChainRewardBeatPips}>
                        {Array.from({ length: entry.beatCount }, (_, beatIndex) => (
                            <i
                                data-chain-reward-ladder-beat={beatIndex + 1}
                                data-chain-reward-ladder-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                key={`${entry.cue.id}-hud-reward-beat-${beatIndex + 1}`}
                            />
                        ))}
                    </span>
                </u>
            ))}
        </span>
    );
};

export default GameplayHudChainRewardLadder;
