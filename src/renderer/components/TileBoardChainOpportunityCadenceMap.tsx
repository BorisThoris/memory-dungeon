import styles from './TileBoard.module.css';

interface ChainOpportunityCadenceMapRow {
    action: string;
    beatCount: number;
    count: number;
    id: string;
    label: string;
    screenCue: string;
    tone: string;
}

interface ChainOpportunityCadenceMapPrimaryRow {
    screenCue: string;
    tone: string;
}

interface TileBoardChainOpportunityCadenceMapProps {
    label: string;
    primaryRow: ChainOpportunityCadenceMapPrimaryRow | null;
    rows: ChainOpportunityCadenceMapRow[];
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}

const TileBoardChainOpportunityCadenceMap = ({
    label,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: TileBoardChainOpportunityCadenceMapProps) => {
    if (rows.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={label}
            className={styles.chainOpportunityCadenceMap}
            data-card-cadence-primary={rows[0]?.id ?? 'none'}
            data-card-cadence-primary-screen-cue={primaryRow?.screenCue ?? 'none'}
            data-card-cadence-primary-tone={primaryRow?.tone ?? 'none'}
            data-card-cadence-map-summary-action={summaryAction ?? 'none'}
            data-card-cadence-map-summary-beats={summaryBeatCount}
            data-card-cadence-map-summary-screen-cue={summaryScreenCue ?? 'none'}
            data-card-cadence-map-summary-tier={summaryTier ?? 'none'}
            data-testid="chain-opportunity-cadence-map"
        >
            <small>Pulse map</small>
            <span
                aria-label={`Pulse map summary. ${rows.length} ${rows.length === 1 ? 'lane' : 'lanes'}. ${summaryAction ?? 'No action'}.`}
                className={styles.chainOpportunityCadenceMapSummary}
                data-card-cadence-map-summary-action={summaryAction ?? 'none'}
                data-card-cadence-map-summary-beats={summaryBeatCount}
                data-card-cadence-map-summary-screen-cue={summaryScreenCue ?? 'none'}
                data-card-cadence-map-summary-tier={summaryTier ?? 'none'}
                data-testid="chain-opportunity-cadence-map-summary"
            >
                <small>Pulses</small>
                <b>
                    {rows.length} {rows.length === 1 ? 'lane' : 'lanes'}
                </b>
                <span aria-hidden="true" className={styles.chainOpportunityCadenceMapSummaryPips}>
                    {Array.from({ length: summaryBeatCount }, (_, index) => (
                        <i
                            data-card-cadence-map-summary-pip={index + 1}
                            data-card-cadence-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
            </span>
            {rows.map((row) => (
                <span
                    aria-label={`Card pulse row. ${row.label}. ${row.count}. ${row.action}. ${row.beatCount}-beat pulse.`}
                    data-card-cadence={row.id}
                    data-card-cadence-focus={row.id === rows[0]?.id ? 'primary' : 'support'}
                    data-card-cadence-screen-cue={row.screenCue}
                    data-card-cadence-tone={row.tone}
                    key={row.id}
                >
                    <b>{row.label}</b>
                    <em>{row.count}</em>
                    <span aria-hidden="true" className={styles.chainOpportunityCadencePips}>
                        {Array.from({ length: row.beatCount }, (_, index) => (
                            <i
                                data-card-cadence-pip={index + 1}
                                data-card-cadence-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <i>{row.action}</i>
                </span>
            ))}
        </span>
    );
};

export default TileBoardChainOpportunityCadenceMap;
