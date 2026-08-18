import { type VisualHudAnnouncementImpact } from './gameScreenFeedback';
import type { HudRecentActionFeedbackModel } from './gameplayHudRecentActionFeedbackModel';
import styles from './GameScreen.module.css';

interface GameplayHudRecentActionProps {
    ariaLabel?: string;
    compactHudAnnouncement: string;
    feedbackModel: HudRecentActionFeedbackModel;
    impact: VisualHudAnnouncementImpact | null;
    label: string;
    title: string;
    tone: string;
}

const GameplayHudRecentAction = ({
    ariaLabel,
    compactHudAnnouncement,
    feedbackModel,
    impact,
    label,
    title,
    tone
}: GameplayHudRecentActionProps) => {
    const impactCue = feedbackModel.impactCue;
    const impactCueBadge = feedbackModel.impactCueBadge;
    const impactBeatCount = feedbackModel.impactBeatCount;
    const impactScreenCue = feedbackModel.impactScreenCue;
    const laneRows = feedbackModel.laneRows;
    const primaryLane = feedbackModel.primaryLane;
    const laneMapAttr = feedbackModel.laneMapAttr;
    const laneActionMapAttr = feedbackModel.laneActionMapAttr;
    const laneMapLabel = feedbackModel.laneMapLabel;
    const stackLabel = feedbackModel.stackLabel;
    const stackSummary = feedbackModel.stackSummary;

    return (
        <div
            aria-label={ariaLabel}
            className={`${styles.statPillCompact} ${styles.hudRecentActionPill}`}
            data-testid="hud-recent-action"
            data-tone={tone}
            title={title}
        >
            <span className={styles.statKey}>{label}</span>
            <span className={styles.statVal}>{compactHudAnnouncement}</span>
            {impact && impact.details.length > 0 ? (
                <span
                    aria-label={`Recent action impact. ${impactCue ?? label}. ${impact.details.length} ${
                        impact.details.length === 1 ? 'detail' : 'details'
                    }.`}
                    className={styles.hudRecentActionImpact}
                    data-burst-tier={impact.burstTier}
                    data-impact-beats={impactBeatCount}
                    data-impact-cue={impactCue ?? 'none'}
                    data-impact-level={impact.level}
                    data-impact-screen-cue={impactScreenCue}
                    data-lane-actions={laneActionMapAttr}
                    data-lane-map={laneMapAttr}
                    data-testid="hud-recent-action-impact"
                >
                    {impactCue ? (
                        <span
                            data-hud-action-impact-beats={impactBeatCount}
                            data-hud-action-impact-cue={impactCue}
                            data-hud-action-impact-cue-id={impactCueBadge?.id ?? 'none'}
                            data-hud-action-impact-screen-cue={impactScreenCue}
                        >
                            {impactCueBadge ? <strong aria-hidden="true">{impactCueBadge.glyph}</strong> : null}
                            <b>{impactCue}</b>
                            <span aria-hidden="true" className={styles.hudRecentActionBeatPips}>
                                {Array.from({ length: impactBeatCount }, (_, beatIndex) => (
                                    <i
                                        data-hud-action-impact-beat={beatIndex + 1}
                                        data-hud-action-impact-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={`${impactCue}-beat-${beatIndex + 1}`}
                                    />
                                ))}
                            </span>
                        </span>
                    ) : null}
                    {stackLabel ? (
                        <span data-hud-action-stack={impact.burstTier} data-hud-action-stack-beats={impactBeatCount}>
                            {stackLabel}
                            <span aria-hidden="true" className={styles.hudRecentActionBeatPips}>
                                {Array.from({ length: impactBeatCount }, (_, beatIndex) => (
                                    <i
                                        data-hud-action-stack-beat={beatIndex + 1}
                                        data-hud-action-stack-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                        key={`${impact.burstTier}-stack-beat-${beatIndex + 1}`}
                                    />
                                ))}
                            </span>
                        </span>
                    ) : null}
                    {impact.details.slice(0, 3).map((detail) => (
                        <span data-action-feedback-detail={detail.tone} key={`${detail.tone}:${detail.label}`}>
                            {detail.label}
                        </span>
                    ))}
                    {laneRows.length > 0 ? (
                        <span
                            aria-label={laneMapLabel ?? undefined}
                            data-hud-action-lane-actions={laneActionMapAttr}
                            data-hud-action-lane-map={laneMapAttr}
                            data-hud-action-primary-lane={primaryLane?.id ?? 'none'}
                            data-hud-action-primary-lane-action={primaryLane?.action ?? 'none'}
                            data-hud-action-primary-lane-audio={primaryLane?.audioCue ?? 'none'}
                            data-hud-action-primary-lane-beats={primaryLane?.beatCount ?? 0}
                            data-hud-action-primary-lane-cue-id={primaryLane?.cueBadge.id ?? 'none'}
                            data-hud-action-primary-lane-screen-cue={primaryLane?.screenCue ?? 'none'}
                            data-testid="hud-recent-action-lane-map"
                        >
                            <span
                                aria-label={`Recent action lane summary. ${laneRows.length} ${
                                    laneRows.length === 1 ? 'lane' : 'lanes'
                                }. ${primaryLane ? primaryLane.summaryLeadLabel : 'No primary lane'}.`}
                                className={styles.hudRecentActionLaneMapSummary}
                                data-hud-action-lane-count={laneRows.length}
                                data-hud-action-lane-summary-primary={primaryLane?.id ?? 'none'}
                                data-hud-action-lane-summary-primary-action={primaryLane?.action ?? 'none'}
                                data-hud-action-lane-summary-primary-audio={primaryLane?.audioCue ?? 'none'}
                                data-hud-action-lane-summary-primary-cue-id={primaryLane?.cueBadge.id ?? 'none'}
                                data-hud-action-lane-summary-primary-screen-cue={primaryLane?.screenCue ?? 'none'}
                                data-testid="hud-recent-action-lane-map-summary"
                            >
                                <small>Lanes</small>
                                <b>
                                    {laneRows.length} {laneRows.length === 1 ? 'lane' : 'lanes'}
                                </b>
                                <span className={styles.hudRecentActionLaneMapSummaryLead}>
                                    {primaryLane ? <i aria-hidden="true">{primaryLane.cueBadge.glyph}</i> : null}
                                    {primaryLane ? primaryLane.summaryLead : 'No primary lane'}
                                </span>
                                <span aria-hidden="true" className={styles.hudRecentActionLaneMapSummaryBeatPips}>
                                    {Array.from({ length: Math.max(2, Math.min(5, laneRows.length + 1)) }, (_, beatIndex) => (
                                        <u
                                            data-hud-action-lane-map-summary-beat={beatIndex + 1}
                                            data-hud-action-lane-map-summary-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                            data-hud-action-lane-map-summary-beat-primary={primaryLane?.id ?? 'none'}
                                            data-hud-action-lane-map-summary-beat-screen-cue={primaryLane?.screenCue ?? 'none'}
                                            key={beatIndex}
                                        />
                                    ))}
                                </span>
                            </span>
                            {primaryLane ? (
                                <b
                                    aria-label={primaryLane.primaryAriaLabel}
                                    className={styles.hudRecentActionPrimaryLaneCue}
                                    data-hud-action-primary-lane={primaryLane.id}
                                    data-hud-action-primary-lane-action={primaryLane.action}
                                    data-hud-action-primary-lane-audio={primaryLane.audioCue}
                                    data-hud-action-primary-lane-beats={primaryLane.beatCount}
                                    data-hud-action-primary-lane-cue-id={primaryLane.cueBadge.id}
                                    data-hud-action-primary-lane-screen-cue={primaryLane.screenCue}
                                    data-testid="hud-recent-action-primary-lane"
                                >
                                    <small>Next lane</small>
                                    <strong aria-hidden="true">{primaryLane.cueBadge.glyph}</strong>
                                    <em>{`${primaryLane.cueBadge.label} cue / ${primaryLane.label}`}</em>
                                    <i>{`${primaryLane.action} / x${primaryLane.count}`}</i>
                                    <span aria-hidden="true" className={styles.hudRecentActionPrimaryLaneBeatPips}>
                                        {Array.from({ length: primaryLane.beatCount }, (_, beatIndex) => (
                                            <u
                                                data-hud-action-primary-lane-beat={beatIndex + 1}
                                                data-hud-action-primary-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                key={beatIndex}
                                            />
                                        ))}
                                    </span>
                                </b>
                            ) : null}
                            {laneRows.map((lane) => (
                                <b
                                    aria-label={lane.ariaLabel}
                                    data-hud-action-lane={lane.id}
                                    data-hud-action-lane-action={lane.action}
                                    data-hud-action-lane-audio={lane.audioCue}
                                    data-hud-action-lane-beats={lane.beatCount}
                                    data-hud-action-lane-cue-id={lane.cueBadge.id}
                                    data-hud-action-lane-focus={lane.id === primaryLane?.id ? 'primary' : 'support'}
                                    data-hud-action-lane-screen-cue={lane.screenCue}
                                    key={lane.id}
                                >
                                    <strong aria-hidden="true">{lane.cueBadge.glyph}</strong>
                                    <em>{`${lane.cueBadge.label} cue / ${lane.label}`}</em>
                                    <i>{`${lane.action} / x${lane.count}`}</i>
                                    <span aria-hidden="true" className={styles.hudRecentActionLaneBeatPips}>
                                        {Array.from({ length: lane.beatCount }, (_, beatIndex) => (
                                            <u
                                                data-hud-action-lane-beat={beatIndex + 1}
                                                data-hud-action-lane-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                                key={beatIndex}
                                            />
                                        ))}
                                    </span>
                                </b>
                            ))}
                        </span>
                    ) : null}
                    {stackSummary ? (
                        <span
                            aria-label={`Recent action stack. ${stackSummary.label}. ${stackSummary.action}. ${stackSummary.value}. ${stackSummary.firstCue}. ${stackSummary.thenCue}. ${stackSummary.keepCue}.`}
                            data-hud-action-stack-action={stackSummary.action}
                            data-hud-action-stack-first={stackSummary.firstCue}
                            data-hud-action-stack-keep={stackSummary.keepCue}
                            data-hud-action-stack-summary={impact.burstTier}
                            data-hud-action-stack-then={stackSummary.thenCue}
                            data-hud-action-stack-tone={stackSummary.tone}
                            data-testid="hud-recent-action-stack-summary"
                        >
                            {stackSummary.label}: <b>{stackSummary.action}</b> {stackSummary.value}
                            <em>
                                <span>{stackSummary.firstCue}</span>
                                <span>{stackSummary.thenCue}</span>
                                <span>{stackSummary.keepCue}</span>
                            </em>
                        </span>
                    ) : null}
                </span>
            ) : null}
        </div>
    );
};

export default GameplayHudRecentAction;
