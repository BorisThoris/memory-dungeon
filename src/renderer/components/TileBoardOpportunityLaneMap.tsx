import type { CSSProperties } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';

interface OpportunityPrimaryLaneView {
    action: string;
    actionId: string;
    ariaLabel: string;
    audio: string;
    beatCount: number;
    cue: string;
    focus: string;
    id: string;
    label: string;
    meterFill: number;
    role: string;
    roleId: string;
    screenCue: string;
}

interface OpportunityLaneRowView {
    action: string;
    actionId: string;
    ariaLabel: string;
    audio: string;
    beatCount: number;
    count: number;
    cue: string;
    id: string;
    label: string;
    meterFill: number;
    role: string;
    roleId: string;
    screenCue: string;
}

interface TileBoardOpportunityLaneMapProps {
    accessibleLabel: string;
    actionIdMap: string;
    actionMap: string;
    compact?: boolean;
    laneMap: string;
    primaryLane: OpportunityPrimaryLaneView | null;
    roleIdMap: string;
    roleMap: string;
    rows: OpportunityLaneRowView[];
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryMeterFill: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}

const TileBoardOpportunityLaneMap = ({
    accessibleLabel,
    actionIdMap,
    actionMap,
    compact = false,
    laneMap,
    primaryLane,
    roleIdMap,
    roleMap,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: TileBoardOpportunityLaneMapProps) => {
    if (rows.length === 0) {
        return null;
    }

    const renderedPrimaryLane = compact ? null : primaryLane;
    const renderedRows = compact ? [] : rows;

    return (
        <span
            aria-label={accessibleLabel}
            className={styles.opportunityLaneMap}
            data-opportunity-lane-actions={actionMap}
            data-opportunity-lane-action-ids={actionIdMap}
            data-opportunity-lane-map-action={summaryAction ?? 'none'}
            data-opportunity-lane-map-beats={summaryBeatCount}
            data-opportunity-lane-map={laneMap}
            data-opportunity-lane-map-screen-cue={summaryScreenCue ?? 'none'}
            data-opportunity-lane-map-tier={summaryTier ?? 'none'}
            data-opportunity-lane-roles={roleMap}
            data-opportunity-lane-role-ids={roleIdMap}
            data-opportunity-primary-lane={primaryLane?.id ?? 'none'}
            data-opportunity-primary-lane-action={primaryLane?.action ?? 'none'}
            data-opportunity-primary-lane-action-id={summaryAction ?? 'none'}
            data-opportunity-primary-lane-audio={primaryLane?.audio ?? 'none'}
            data-opportunity-primary-lane-beats={primaryLane?.beatCount ?? 0}
            data-opportunity-primary-lane-cue={primaryLane?.cue ?? 'none'}
            data-opportunity-primary-lane-focus={primaryLane?.focus ?? 'none'}
            data-opportunity-primary-lane-role={primaryLane?.role ?? 'none'}
            data-opportunity-primary-lane-role-id={primaryLane?.roleId ?? 'none'}
            data-opportunity-primary-lane-screen-cue={primaryLane?.screenCue ?? 'none'}
            data-testid="board-opportunity-lane-map"
        >
            <span
                aria-label={`Opportunity lane summary. ${rows.length} ${rows.length === 1 ? 'lane' : 'lanes'}. ${
                    primaryLane ? `${primaryLane.action}: ${primaryLane.cue}` : 'No primary lane'
                }.`}
                className={styles.opportunityLaneMapSummary}
                data-opportunity-lane-map-action={summaryAction ?? 'none'}
                data-opportunity-lane-map-beats={summaryBeatCount}
                data-testid="board-opportunity-lane-map-summary"
                data-opportunity-lane-map-meter-fill={summaryMeterFill}
                data-opportunity-lane-map-screen-cue={summaryScreenCue ?? 'none'}
                data-opportunity-lane-map-tier={summaryTier ?? 'none'}
                style={
                    {
                        '--opportunity-lane-map-meter-fill': `${summaryMeterFill}%`
                    } as CSSProperties
                }
            >
                {compact ? null : <small>Lanes</small>}
                <b>
                    {rows.length} {rows.length === 1 ? 'lane' : 'lanes'}
                </b>
                {compact ? null : (
                    <FeedbackBeatPips
                        className={styles.opportunityLaneMapSummaryBeatPips}
                        count={summaryBeatCount}
                        itemProps={(index) => ({
                            'data-opportunity-lane-map-summary-beat': index + 1,
                            'data-opportunity-lane-map-summary-beat-focus': index === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`opportunity-lane-summary-${summaryAction ?? 'none'}`}
                    />
                )}
                {compact ? null : (
                    <i aria-hidden="true" className={styles.opportunityLaneMapMeter}>
                        <i aria-hidden="true" className={styles.opportunityLaneMapMeterFill} />
                    </i>
                )}
            </span>
            {renderedPrimaryLane ? (
                <span
                    aria-label={renderedPrimaryLane.ariaLabel}
                    className={styles.opportunityPrimaryLane}
                    data-opportunity-primary-lane={renderedPrimaryLane.id}
                    data-opportunity-primary-lane-action={renderedPrimaryLane.action}
                    data-opportunity-primary-lane-action-id={renderedPrimaryLane.actionId}
                    data-opportunity-primary-lane-audio={renderedPrimaryLane.audio}
                    data-opportunity-primary-lane-beats={renderedPrimaryLane.beatCount}
                    data-opportunity-primary-lane-meter-fill={renderedPrimaryLane.meterFill}
                    data-opportunity-primary-lane-cue={renderedPrimaryLane.cue}
                    data-opportunity-primary-lane-focus={renderedPrimaryLane.focus}
                    data-opportunity-primary-lane-role={renderedPrimaryLane.role}
                    data-opportunity-primary-lane-role-id={renderedPrimaryLane.roleId}
                    data-opportunity-primary-lane-screen-cue={renderedPrimaryLane.screenCue}
                    data-testid="board-opportunity-primary-lane"
                    style={
                        {
                            '--opportunity-primary-lane-meter-fill': `${renderedPrimaryLane.meterFill}%`
                        } as CSSProperties
                    }
                    >
                    {compact ? null : <small>Board focus</small>}
                    <b>{renderedPrimaryLane.label}</b>
                    {compact ? null : <u>{renderedPrimaryLane.role}</u>}
                    <strong>{renderedPrimaryLane.action}</strong>
                    {compact ? null : <em>{renderedPrimaryLane.cue}</em>}
                    {compact ? null : (
                        <FeedbackBeatPips
                            className={styles.opportunityPrimaryLaneBeatPips}
                            count={renderedPrimaryLane.beatCount}
                            itemProps={(beatIndex) => ({
                                'data-opportunity-primary-lane-beat': beatIndex + 1,
                                'data-opportunity-primary-lane-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                            })}
                            keyPrefix={`opportunity-primary-lane-${renderedPrimaryLane.id}`}
                        />
                    )}
                </span>
            ) : null}
            {renderedRows.map((lane) => (
                <span
                    aria-label={lane.ariaLabel}
                    data-opportunity-lane={lane.id}
                    data-opportunity-lane-action={lane.action}
                    data-opportunity-lane-action-id={lane.actionId}
                    data-opportunity-lane-audio={lane.audio}
                    data-opportunity-lane-beats={lane.beatCount}
                    data-opportunity-lane-count={lane.count}
                    data-opportunity-lane-meter-fill={lane.meterFill}
                    data-opportunity-lane-role={lane.role}
                    data-opportunity-lane-role-id={lane.roleId}
                    data-opportunity-lane-screen-cue={lane.screenCue}
                    style={
                        {
                            '--opportunity-lane-meter-fill': `${lane.meterFill}%`
                        } as CSSProperties
                    }
                    key={lane.id}
                >
                    <small>{lane.label}</small>
                    <b>{lane.count}</b>
                    <u>{lane.role}</u>
                    <strong>{lane.action}</strong>
                    <em>{lane.cue}</em>
                    <FeedbackBeatPips
                        className={styles.opportunityLaneBeatPips}
                        count={lane.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-opportunity-lane-beat': beatIndex + 1,
                            'data-opportunity-lane-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`opportunity-lane-${lane.id}`}
                    />
                </span>
            ))}
        </span>
    );
};

export default TileBoardOpportunityLaneMap;
