import type { TraitRouteObjectiveStatus } from '../../shared/trait-route-objectives';
import type {
    HudTraitInteractionLaneFeedbackModel,
    HudTraitOpportunitySummaryModel,
    HudTraitRouteStackCueModel
} from './gameplayHudTraitRouteFeedbackModels';
import GameplayHudTraitInteractionLaneMap from './GameplayHudTraitInteractionLaneMap';
import styles from './GameScreen.module.css';

export interface GameplayHudTraitRouteDetailsProps {
    laneFeedbackModel: HudTraitInteractionLaneFeedbackModel;
    routeStatus: TraitRouteObjectiveStatus | null;
    stackCue: HudTraitRouteStackCueModel | null;
    summaryModel: HudTraitOpportunitySummaryModel;
    swapHintText: string | null;
    toolLine: string;
}

const GameplayHudTraitRouteDetails = ({
    laneFeedbackModel,
    routeStatus,
    stackCue,
    summaryModel,
    swapHintText,
    toolLine
}: GameplayHudTraitRouteDetailsProps) => (
    <div className={styles.hudTraitRouteDetails} data-testid="hud-trait-route-details">
        <span className={styles.statKey}>Trait Route Panel</span>
        <strong>{summaryModel.detailBuildLabel}</strong>
        {summaryModel.cardLine ? <span>Cards: {summaryModel.cardLine}</span> : null}
        {summaryModel.detailInteractionLines.map((line) => (
            <span key={line}>{line}</span>
        ))}
        {swapHintText ? <span>{swapHintText}</span> : null}
        {laneFeedbackModel.laneRows.length > 0 ? (
            <>
                <span className={styles.hudTraitRouteLaneMapLabel}>Trait lanes</span>
                <GameplayHudTraitInteractionLaneMap
                    feedbackModel={laneFeedbackModel}
                    summaryTestId="hud-trait-route-lane-map-summary-details"
                    testId="hud-trait-route-lane-map-details"
                />
            </>
        ) : null}
        {routeStatus ? (
            <small
                aria-label={`Trait route details action. ${routeStatus.actionLabel}. ${routeStatus.stateLabel}. Reward: ${routeStatus.reward}.`}
                data-testid="hud-trait-route-details-action"
                data-trait-route-urgency={routeStatus.urgency}
            >
                Now: {routeStatus.actionLabel}. {routeStatus.stateLabel}. Reward: {routeStatus.reward}.
            </small>
        ) : null}
        {stackCue ? (
            <small data-testid="hud-trait-route-details-stack">Stack: {stackCue.action}. {stackCue.value}.</small>
        ) : null}
        <small>{toolLine}</small>
    </div>
);

export default GameplayHudTraitRouteDetails;
