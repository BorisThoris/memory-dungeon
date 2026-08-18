import type { HudInRunCauseFeedbackModel } from './gameplayHudInRunCauseFeedbackModel';
import styles from './GameScreen.module.css';

interface GameplayHudInRunCauseStripProps {
    feedbackModel: HudInRunCauseFeedbackModel;
}

const GameplayHudInRunCauseStrip = ({ feedbackModel }: GameplayHudInRunCauseStripProps) => {
    const { primaryRow, rows } = feedbackModel;

    if (rows.length === 0) {
        return null;
    }

    return (
        <div
            aria-label="Recent run feedback"
            className={styles.hudFeedbackStrip}
            data-hud-cause-primary={primaryRow?.id ?? 'none'}
            data-hud-cause-primary-action={primaryRow?.action ?? 'none'}
            data-hud-cause-primary-audio={primaryRow?.audioCue ?? 'none'}
            data-hud-cause-primary-beats={primaryRow?.beatCount ?? 0}
            data-hud-cause-primary-kind={primaryRow?.kind ?? 'none'}
            data-hud-cause-primary-screen-cue={primaryRow?.screenCue ?? 'none'}
            data-testid="hud-in-run-cause-strip"
        >
            {primaryRow ? (
                <span
                    aria-label={primaryRow.primaryAriaLabel}
                    className={styles.hudFeedbackPrimaryCause}
                    data-hud-cause-primary={primaryRow.id}
                    data-hud-cause-primary-action={primaryRow.action}
                    data-hud-cause-primary-audio={primaryRow.audioCue}
                    data-hud-cause-primary-beats={primaryRow.beatCount}
                    data-hud-cause-primary-kind={primaryRow.kind}
                    data-hud-cause-primary-screen-cue={primaryRow.screenCue}
                    data-testid="hud-primary-cause-cue"
                >
                    <small>Primary cause</small>
                    <b>{primaryRow.action}</b>
                    <em>{primaryRow.label}</em>
                    <strong>{primaryRow.summary}</strong>
                    <span aria-hidden="true" className={styles.hudFeedbackPrimaryCauseBeatPips}>
                        {Array.from({ length: primaryRow.beatCount }, (_, beatIndex) => (
                            <i
                                data-hud-cause-primary-beat={beatIndex + 1}
                                data-hud-cause-primary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                key={beatIndex}
                            />
                        ))}
                    </span>
                </span>
            ) : null}
            {rows.map((row) => (
                <span
                    className={styles.hudFeedbackChip}
                    data-feedback-action={row.action}
                    data-feedback-beats={row.beatCount}
                    data-feedback-kind={row.kind}
                    data-testid={`hud-cause-row-${row.id}`}
                    key={row.id}
                    title={row.detail}
                >
                    <span className={styles.statKey}>{row.label}</span>
                    <span className={styles.statVal}>{row.summary}</span>
                </span>
            ))}
        </div>
    );
};

export default GameplayHudInRunCauseStrip;
