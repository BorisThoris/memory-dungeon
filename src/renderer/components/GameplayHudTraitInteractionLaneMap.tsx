import type { HudTraitInteractionLaneFeedbackModel } from './gameplayHudTraitRouteFeedbackModels';
import styles from './GameScreen.module.css';

interface GameplayHudTraitInteractionLaneMapProps {
    feedbackModel: HudTraitInteractionLaneFeedbackModel;
    summaryTestId: string;
    testId: string;
}

const GameplayHudTraitInteractionLaneMap = ({
    feedbackModel,
    summaryTestId,
    testId
}: GameplayHudTraitInteractionLaneMapProps) => {
    const { actionMapAttr, laneMapLabel, laneRows, mapAttr, primaryLane, roleIdMapAttr, roleMapAttr, summaryAriaLabel, summaryBeatCount, summaryScreenCue } =
        feedbackModel;

    if (laneRows.length === 0) {
        return null;
    }

    return (
        <div
            aria-label={laneMapLabel}
            className={styles.hudTraitRouteLaneMap}
            data-testid={testId}
            data-trait-interaction-lane-actions={actionMapAttr}
            data-trait-interaction-lane-map={mapAttr}
            data-trait-interaction-lane-role-ids={roleIdMapAttr}
            data-trait-interaction-lane-roles={roleMapAttr}
        >
            <span
                aria-label={summaryAriaLabel}
                className={styles.hudTraitRouteLaneMapSummary}
                data-testid={summaryTestId}
                data-trait-interaction-lane-count={laneRows.length}
                data-trait-interaction-lane-summary-cue-id={primaryLane?.cueBadge.id ?? 'none'}
                data-trait-interaction-lane-summary-primary={primaryLane?.id ?? 'none'}
                data-trait-interaction-lane-summary-role-id={primaryLane?.roleId ?? 'none'}
                data-trait-interaction-lane-summary-screen-cue={summaryScreenCue}
            >
                <small>Trait lanes</small>
                <b>
                    {laneRows.length} {laneRows.length === 1 ? 'lane' : 'lanes'}
                </b>
                <span className={styles.hudTraitRouteLaneMapSummaryLead}>
                    {primaryLane ? <i aria-hidden="true">{primaryLane.cueBadge.glyph}</i> : null}
                    {primaryLane ? `${primaryLane.role} ${primaryLane.label}` : 'No lead lane'}
                </span>
                <span aria-hidden="true" className={styles.hudTraitRouteLaneMapSummaryBeatPips}>
                    {Array.from({ length: summaryBeatCount }, (_, beatIndex) => (
                        <i
                            data-trait-interaction-lane-summary-beat={beatIndex + 1}
                            data-trait-interaction-lane-summary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                            data-trait-interaction-lane-summary-beat-role-id={primaryLane?.roleId ?? 'none'}
                            data-trait-interaction-lane-summary-beat-screen-cue={summaryScreenCue}
                            key={beatIndex}
                        />
                    ))}
                </span>
            </span>
            {laneRows.map((lane) => (
                <span
                    aria-label={lane.ariaLabel}
                    data-trait-interaction-lane={lane.id}
                    data-trait-interaction-lane-cue-id={lane.cueBadge.id}
                    data-trait-interaction-lane-role={lane.role}
                    data-trait-interaction-lane-role-id={lane.roleId ?? 'none'}
                    key={lane.id}
                >
                    <small>{lane.label}</small>
                    <strong aria-hidden="true">{lane.cueBadge.glyph}</strong>
                    <b>{`${lane.role} / ${lane.action}`}</b>
                    <em>
                        {lane.cueBadge.label} cue / {lane.countLabel} / {lane.cue}
                    </em>
                </span>
            ))}
        </div>
    );
};

export default GameplayHudTraitInteractionLaneMap;
