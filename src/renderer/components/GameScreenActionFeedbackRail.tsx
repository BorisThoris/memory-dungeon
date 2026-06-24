import styles from './GameScreen.module.css';

interface GameScreenActionFeedbackRailProps {
    followup: string | null;
    label: string;
    message: string;
    tone: 'error' | 'info';
}

export const GameScreenActionFeedbackRail = ({
    followup,
    label,
    message,
    tone
}: GameScreenActionFeedbackRailProps) => (
    <div
        aria-hidden="true"
        className={styles.actionFeedbackRail}
        data-testid="action-feedback-rail"
        data-tone={tone}
    >
        <span>{label}</span>
        <strong>{message}</strong>
        {followup ? <small>{followup}</small> : null}
    </div>
);

