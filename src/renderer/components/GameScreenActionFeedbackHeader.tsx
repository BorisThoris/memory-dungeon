import type { MatchScorePopCrescendo } from '../store/matchScorePop';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './GameScreen.module.css';

interface GameScreenActionFeedbackHeaderSignal {
    label: string;
    tone: string;
}

interface GameScreenActionFeedbackHeaderPayoffIntensity {
    action: string;
    count: number;
    id: 'build' | 'cashout' | 'none' | 'prime' | 'risk' | 'stack' | 'surge';
    label: string;
}

interface GameScreenActionFeedbackHeaderImpactCue {
    label: string;
    tone: 'chain' | 'reward' | 'combo' | 'risk' | 'trait' | 'info';
}

interface GameScreenActionFeedbackHeaderTempoCue {
    label: string;
    tone: 'chain' | 'reward' | 'combo' | 'risk' | 'trait' | 'info';
    value: string;
}

interface GameScreenActionFeedbackHeaderTempoBeat {
    beatCount: 2 | 3 | 4;
    cadence: 'burst' | 'guard' | 'pulse' | 'steady' | 'swing';
    label: string;
}

interface GameScreenActionFeedbackHeaderProps {
    burstTier: 'none' | 'chain' | 'reward' | 'combo' | 'risk' | 'trait';
    crescendoTone: 'chain' | 'combo' | 'reward' | 'score';
    displayedCrescendo: MatchScorePopCrescendo | null;
    impactAction: string;
    impactAudioCue: string;
    impactCue: GameScreenActionFeedbackHeaderImpactCue;
    impactScreenCue: string;
    label: string;
    payoffAudioCue: string;
    payoffBeatCount: 0 | 1 | 2 | 3 | 4 | 5;
    payoffIntensity: GameScreenActionFeedbackHeaderPayoffIntensity;
    payoffScreenCue: string;
    signal: GameScreenActionFeedbackHeaderSignal | null;
    stackLabel: string | null;
    tempoAudioCue: string;
    tempoBeat: GameScreenActionFeedbackHeaderTempoBeat;
    tempoCue: GameScreenActionFeedbackHeaderTempoCue;
    tempoScreenCue: string;
}

const GameScreenActionFeedbackHeader = ({
    burstTier,
    crescendoTone,
    displayedCrescendo,
    impactAction,
    impactAudioCue,
    impactCue,
    impactScreenCue,
    label,
    payoffAudioCue,
    payoffBeatCount,
    payoffIntensity,
    payoffScreenCue,
    signal,
    stackLabel,
    tempoAudioCue,
    tempoBeat,
    tempoCue,
    tempoScreenCue
}: GameScreenActionFeedbackHeaderProps) => (
    <span className={styles.actionFeedbackHeader}>
        <span>{label}</span>
        {signal ? (
            <span className={styles.actionFeedbackSignal} data-action-feedback-signal={signal.tone}>
                {signal.label}
            </span>
        ) : null}
        {stackLabel ? (
            <span className={styles.actionFeedbackStackBadge} data-action-feedback-stack={burstTier}>
                {stackLabel}
            </span>
        ) : null}
        {payoffIntensity.id !== 'none' ? (
            <span
                aria-label={`Action feedback payoff intensity. ${payoffIntensity.count} ${payoffIntensity.label}. ${payoffIntensity.action}. ${payoffBeatCount} beats.`}
                className={styles.actionFeedbackPayoffIntensity}
                data-action-feedback-payoff-action={payoffIntensity.action}
                data-action-feedback-payoff-audio={payoffAudioCue}
                data-action-feedback-payoff-beats={payoffBeatCount}
                data-action-feedback-payoff-intensity={payoffIntensity.id}
                data-action-feedback-payoff-screen-cue={payoffScreenCue}
                data-testid="action-feedback-payoff-intensity"
            >
                <small>{payoffIntensity.count}</small>
                <strong>{payoffIntensity.label}</strong>
                <FeedbackBeatPips
                    className={styles.actionFeedbackPayoffPips}
                    count={payoffBeatCount}
                    itemProps={(beatIndex) => ({
                        'data-action-feedback-payoff-beat': beatIndex + 1,
                        'data-action-feedback-payoff-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`action-feedback-payoff-${payoffIntensity.id}`}
                />
                <em>{payoffIntensity.action}</em>
            </span>
        ) : null}
        {displayedCrescendo ? (
            <span
                aria-label={`Action feedback crescendo. ${displayedCrescendo.label}. ${displayedCrescendo.detail}. ${displayedCrescendo.beatCount} beats.`}
                className={styles.actionFeedbackCrescendo}
                data-action-feedback-crescendo-action={displayedCrescendo.detail}
                data-action-feedback-crescendo-audio={displayedCrescendo.audioCue}
                data-action-feedback-crescendo-cue={displayedCrescendo.screenCue}
                data-action-feedback-crescendo-screen-cue={displayedCrescendo.screenCue}
                data-action-feedback-crescendo-tier={displayedCrescendo.tier}
                data-action-feedback-crescendo-tone={crescendoTone}
                data-testid="action-feedback-crescendo"
            >
                <small>{displayedCrescendo.beatCount} beat</small>
                <FeedbackBeatPips
                    className={styles.actionFeedbackCrescendoPips}
                    count={displayedCrescendo.beatCount}
                    itemProps={(beatIndex) => ({
                        'data-action-feedback-crescendo-beat': beatIndex + 1,
                        'data-action-feedback-crescendo-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`action-feedback-crescendo-${displayedCrescendo.tier}`}
                />
                <strong>{displayedCrescendo.label}</strong>
                <em>{displayedCrescendo.detail}</em>
            </span>
        ) : null}
        <span
            aria-label={`Action feedback impact. ${impactCue.label}. ${impactAction}.`}
            className={styles.actionFeedbackImpactCue}
            data-action-feedback-impact-action={impactAction}
            data-action-feedback-impact-audio={impactAudioCue}
            data-action-feedback-impact-screen-cue={impactScreenCue}
            data-action-feedback-impact-tone={impactCue.tone}
            data-testid="action-feedback-impact-cue"
        >
            {impactCue.label}
            <em>{impactAction}</em>
        </span>
        <span
            aria-label={`Action feedback tempo. ${tempoCue.label}: ${tempoCue.value}. ${tempoBeat.label}. ${tempoBeat.beatCount} beats.`}
            className={styles.actionFeedbackTempoCue}
            data-action-feedback-tempo-action={tempoCue.value}
            data-action-feedback-tempo-audio={tempoAudioCue}
            data-action-feedback-tempo-beats={tempoBeat.beatCount}
            data-action-feedback-tempo-cadence={tempoBeat.cadence}
            data-action-feedback-tempo-label={tempoBeat.label}
            data-action-feedback-tempo-screen-cue={tempoScreenCue}
            data-action-feedback-tempo-tone={tempoCue.tone}
            data-testid="action-feedback-tempo-cue"
        >
            <small>{tempoCue.label}</small>
            <strong>{tempoCue.value}</strong>
            <FeedbackBeatPips
                className={styles.actionFeedbackTempoPips}
                count={tempoBeat.beatCount}
                itemProps={(beatIndex) => ({
                    'data-action-feedback-tempo-beat': beatIndex + 1,
                    'data-action-feedback-tempo-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                })}
                keyPrefix={`action-feedback-tempo-${tempoBeat.cadence}`}
            />
            <em>{tempoBeat.label}</em>
        </span>
    </span>
);

export default GameScreenActionFeedbackHeader;
