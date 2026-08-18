import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './GameScreen.module.css';

interface ActionFeedbackDecoratedLane {
    action: 'Cash now' | 'Route next' | 'Protect streak' | 'Cash trait' | 'Recover';
    audioCue: 'feedback-cash-lane' | 'feedback-chain-lane' | 'feedback-recover-lane' | 'feedback-route-lane' | 'feedback-trait-lane';
    beatCount: 2 | 3 | 4;
    count: number;
    cue: string;
    id: 'cash' | 'route' | 'chain' | 'trait' | 'recover';
    label: 'Cash' | 'Route' | 'Chain' | 'Trait' | 'Recover';
    role: 'Cashout' | 'Protect' | 'Recover' | 'Route' | 'Trait';
    roleId: 'cashout' | 'protect' | 'recover' | 'route' | 'trait';
    screenCue: 'burst' | 'guard' | 'pulse' | 'recover' | 'route';
}

interface GameScreenActionFeedbackLaneMapProps {
    laneActionMapAttr: string;
    laneMapAttr: string;
    laneMapLabel: string;
    laneRoleIdMapAttr: string;
    laneRoleMapAttr: string;
    lanes: ActionFeedbackDecoratedLane[];
    primaryLane: ActionFeedbackDecoratedLane | null;
}

const GameScreenActionFeedbackLaneMap = ({
    laneActionMapAttr,
    laneMapAttr,
    laneMapLabel,
    laneRoleIdMapAttr,
    laneRoleMapAttr,
    lanes,
    primaryLane
}: GameScreenActionFeedbackLaneMapProps) => {
    if (lanes.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={laneMapLabel}
            className={styles.actionFeedbackLaneMap}
            data-action-feedback-lane-actions={laneActionMapAttr}
            data-action-feedback-lane-map={laneMapAttr}
            data-action-feedback-lane-roles={laneRoleMapAttr}
            data-action-feedback-lane-role-ids={laneRoleIdMapAttr}
            data-action-feedback-primary-lane={primaryLane?.id ?? 'none'}
            data-action-feedback-primary-lane-action={primaryLane?.action ?? 'none'}
            data-action-feedback-primary-lane-audio={primaryLane?.audioCue ?? 'none'}
            data-action-feedback-primary-lane-beats={primaryLane?.beatCount ?? 0}
            data-action-feedback-primary-lane-cue={primaryLane?.cue ?? 'none'}
            data-action-feedback-primary-lane-role={primaryLane?.role ?? 'none'}
            data-action-feedback-primary-lane-role-id={primaryLane?.roleId ?? 'none'}
            data-action-feedback-primary-lane-screen-cue={primaryLane?.screenCue ?? 'none'}
            data-testid="action-feedback-lane-map"
        >
            <span
                aria-label={`Action feedback lane summary. ${lanes.length} ${
                    lanes.length === 1 ? 'lane' : 'lanes'
                }. ${primaryLane ? `${primaryLane.role} ${primaryLane.label}` : 'No primary lane'}.`}
                className={styles.actionFeedbackLaneMapSummary}
                data-action-feedback-lane-count={lanes.length}
                data-action-feedback-lane-summary-primary={primaryLane?.id ?? 'none'}
                data-action-feedback-lane-summary-primary-action={primaryLane?.action ?? 'none'}
                data-action-feedback-lane-summary-primary-audio={primaryLane?.audioCue ?? 'none'}
                data-action-feedback-lane-summary-primary-role={primaryLane?.role ?? 'none'}
                data-action-feedback-lane-summary-primary-role-id={primaryLane?.roleId ?? 'none'}
                data-action-feedback-lane-summary-primary-screen-cue={primaryLane?.screenCue ?? 'none'}
                data-testid="action-feedback-lane-map-summary"
            >
                <small>Lanes</small>
                <b>
                    {lanes.length} {lanes.length === 1 ? 'lane' : 'lanes'}
                </b>
                <FeedbackBeatPips
                    className={styles.actionFeedbackLaneMapSummaryBeatPips}
                    count={Math.max(2, Math.min(5, lanes.length + 1))}
                    itemProps={(beatIndex) => ({
                        'data-action-feedback-lane-map-summary-beat': beatIndex + 1,
                        'data-action-feedback-lane-map-summary-beat-focus': beatIndex === 0 ? 'primary' : 'support',
                        'data-action-feedback-lane-map-summary-beat-primary': primaryLane?.id ?? 'none',
                        'data-action-feedback-lane-map-summary-beat-role-id': primaryLane?.roleId ?? 'none',
                        'data-action-feedback-lane-map-summary-beat-screen-cue': primaryLane?.screenCue ?? 'none'
                    })}
                    keyPrefix="action-feedback-lane-map-summary"
                />
            </span>
            {primaryLane ? (
                <span
                    aria-label={`Primary feedback lane. ${primaryLane.role} ${primaryLane.label}: ${primaryLane.action}. ${primaryLane.cue}. ${primaryLane.beatCount} beats.`}
                    className={styles.actionFeedbackPrimaryLaneCue}
                    data-action-feedback-primary-lane={primaryLane.id}
                    data-action-feedback-primary-lane-action={primaryLane.action}
                    data-action-feedback-primary-lane-audio={primaryLane.audioCue}
                    data-action-feedback-primary-lane-beats={primaryLane.beatCount}
                    data-action-feedback-primary-lane-cue={primaryLane.cue}
                    data-action-feedback-primary-lane-role={primaryLane.role}
                    data-action-feedback-primary-lane-role-id={primaryLane.roleId}
                    data-action-feedback-primary-lane-screen-cue={primaryLane.screenCue}
                    data-testid="action-feedback-primary-lane"
                >
                    <small>Next chase</small>
                    <b>{primaryLane.role}</b>
                    <strong>{primaryLane.action}</strong>
                    <em>{primaryLane.cue}</em>
                    <FeedbackBeatPips
                        className={styles.actionFeedbackPrimaryLaneBeatPips}
                        count={primaryLane.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-action-feedback-primary-lane-beat': beatIndex + 1,
                            'data-action-feedback-primary-lane-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`action-feedback-primary-lane-${primaryLane.id}`}
                    />
                </span>
            ) : null}
            {lanes.map((lane) => (
                <span
                    data-action-feedback-lane={lane.id}
                    data-action-feedback-lane-action={lane.action}
                    data-action-feedback-lane-audio={lane.audioCue}
                    data-action-feedback-lane-beats={lane.beatCount}
                    data-action-feedback-lane-count={lane.count}
                    data-action-feedback-lane-role={lane.role}
                    data-action-feedback-lane-role-id={lane.roleId}
                    data-action-feedback-lane-screen-cue={lane.screenCue}
                    key={lane.id}
                >
                    <small>{lane.label}</small>
                    <b>{lane.role}</b>
                    <strong>{lane.action}</strong>
                    <em>
                        x{lane.count} / {lane.cue}
                    </em>
                    <FeedbackBeatPips
                        className={styles.actionFeedbackLaneBeatPips}
                        count={lane.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-action-feedback-lane-beat': beatIndex + 1,
                            'data-action-feedback-lane-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`action-feedback-lane-${lane.id}`}
                    />
                </span>
            ))}
        </span>
    );
};

export default GameScreenActionFeedbackLaneMap;
