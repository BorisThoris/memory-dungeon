import { type CSSProperties } from 'react';
import styles from './TileBoard.module.css';

interface ChainOpportunityBeatMapRow {
    action: string;
    beatCount: number;
    count: number;
    id: string;
    label: string;
    screenCue: string;
    tone: string;
}

interface ChainOpportunityBeatMapPrimaryRow {
    id: string;
    screenCue: string;
    tone: string;
}

interface TileBoardChainOpportunityBeatMapProps {
    actionMapAttr: string;
    label: string;
    primaryRow: ChainOpportunityBeatMapPrimaryRow | null;
    rows: ChainOpportunityBeatMapRow[];
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryMeterFill: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}

const TileBoardChainOpportunityBeatMap = ({
    actionMapAttr,
    label,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: TileBoardChainOpportunityBeatMapProps) => {
    if (rows.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={label}
            className={styles.chainOpportunityBeatMap}
            data-card-beat-actions={actionMapAttr}
            data-card-beat-primary={rows[0]?.id ?? 'none'}
            data-card-beat-primary-screen-cue={primaryRow?.screenCue ?? 'none'}
            data-card-beat-primary-tone={primaryRow?.tone ?? 'none'}
            data-card-beat-map-summary-action={summaryAction ?? 'none'}
            data-card-beat-map-summary-beats={summaryBeatCount}
            data-card-beat-map-summary-screen-cue={summaryScreenCue ?? 'none'}
            data-card-beat-map-summary-tier={summaryTier ?? 'none'}
            data-testid="chain-opportunity-beat-map"
        >
            <small>Beat map</small>
            <span
                aria-label={`Beat map summary. ${rows.length} ${rows.length === 1 ? 'lane' : 'lanes'}. ${summaryAction ?? 'No action'}.`}
                className={styles.chainOpportunityBeatMapSummary}
                data-card-beat-map-summary-action={summaryAction ?? 'none'}
                data-card-beat-map-summary-beats={summaryBeatCount}
                data-card-beat-map-summary-meter-fill={summaryMeterFill}
                data-card-beat-map-summary-screen-cue={summaryScreenCue ?? 'none'}
                data-card-beat-map-summary-tier={summaryTier ?? 'none'}
                data-testid="chain-opportunity-beat-map-summary"
                style={{ '--card-beat-map-summary-meter-fill': `${summaryMeterFill}%` } as CSSProperties}
            >
                <small>Beats</small>
                <b>
                    {rows.length} {rows.length === 1 ? 'lane' : 'lanes'}
                </b>
                <i aria-hidden="true" className={styles.chainOpportunityBeatMapSummaryMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityBeatMapSummaryMeterFill} />
                </i>
                <span aria-hidden="true" className={styles.chainOpportunityBeatMapSummaryPips}>
                    {Array.from({ length: summaryBeatCount }, (_, index) => (
                        <i
                            data-card-beat-map-summary-pip={index + 1}
                            data-card-beat-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
            </span>
            {rows.map((row) => (
                <span
                    aria-label={`Card beat row. ${row.label}. ${row.count}. ${row.beatCount}-beat ${row.action}.`}
                    data-card-beat-action={row.action}
                    data-card-beat-focus={row.id === rows[0]?.id ? 'primary' : 'support'}
                    data-card-beat-screen-cue={row.screenCue}
                    data-card-beat-tier={row.id}
                    data-card-beat-tone={row.tone}
                    key={row.id}
                >
                    <b>{row.label}</b>
                    <em>{row.count}</em>
                    <span aria-hidden="true" className={styles.chainOpportunityBeatMapPips}>
                        {Array.from({ length: row.beatCount }, (_, index) => (
                            <i
                                data-card-beat-pip={index + 1}
                                data-card-beat-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <i>{row.beatCount}-beat {row.action}</i>
                </span>
            ))}
        </span>
    );
};

export default TileBoardChainOpportunityBeatMap;
