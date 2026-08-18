import type { VisualHudAnnouncementDetail } from './gameScreenFeedback';
import styles from './GameScreen.module.css';

interface GameScreenActionFeedbackDetailsProps {
    details: VisualHudAnnouncementDetail[];
    getDetailKind: (label: string) => string;
}

const GameScreenActionFeedbackDetails = ({ details, getDetailKind }: GameScreenActionFeedbackDetailsProps) => {
    if (details.length === 0) {
        return null;
    }

    return (
        <span className={styles.actionFeedbackDetails} data-testid="action-feedback-details">
            {details.map((detail) => (
                <span
                    data-action-feedback-detail={detail.tone}
                    data-action-feedback-detail-kind={getDetailKind(detail.label)}
                    key={`${detail.tone}:${detail.label}`}
                >
                    {detail.label}
                </span>
            ))}
        </span>
    );
};

export default GameScreenActionFeedbackDetails;
