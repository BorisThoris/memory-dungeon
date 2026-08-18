import styles from './TileBoard.module.css';

interface ChainOpportunityShotMapRow {
    count: number;
    detail: string;
    id: string;
    role: string;
    screenCue: string;
    shotLabel: string;
    tone: string;
}

interface ChainOpportunityShotMapPrimaryRow {
    role: string;
    screenCue: string;
    tone: string;
}

interface TileBoardChainOpportunityShotMapProps {
    label: string;
    primaryActionId: string;
    primaryRow: ChainOpportunityShotMapPrimaryRow | null;
    rows: ChainOpportunityShotMapRow[];
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}

const TileBoardChainOpportunityShotMap = ({
    label,
    primaryActionId,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: TileBoardChainOpportunityShotMapProps) => {
    if (rows.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={label}
            className={styles.chainOpportunityShotMap}
            data-chain-shot-map-primary={primaryActionId}
            data-chain-shot-map-primary-role={primaryRow?.role ?? 'none'}
            data-chain-shot-map-primary-role-id={primaryRow?.tone ?? 'none'}
            data-chain-shot-map-primary-screen-cue={primaryRow?.screenCue ?? 'none'}
            data-chain-shot-map-primary-tone={primaryRow?.tone ?? 'none'}
            data-chain-shot-map-summary-action={summaryAction ?? 'none'}
            data-chain-shot-map-summary-beats={summaryBeatCount}
            data-chain-shot-map-summary-screen-cue={summaryScreenCue ?? 'none'}
            data-chain-shot-map-summary-tier={summaryTier ?? 'none'}
            data-testid="chain-opportunity-shot-map"
        >
            <small>Shot map</small>
            <span
                aria-label={`Shot map summary. ${rows.length} ${rows.length === 1 ? 'lane' : 'lanes'}. ${summaryAction ?? 'No action'}.`}
                className={styles.chainOpportunityShotMapSummary}
                data-chain-shot-map-summary-action={summaryAction ?? 'none'}
                data-chain-shot-map-summary-beats={summaryBeatCount}
                data-chain-shot-map-summary-screen-cue={summaryScreenCue ?? 'none'}
                data-chain-shot-map-summary-tier={summaryTier ?? 'none'}
                data-testid="chain-opportunity-shot-map-summary"
            >
                <small>Shots</small>
                <b>
                    {rows.length} {rows.length === 1 ? 'lane' : 'lanes'}
                </b>
                <span aria-hidden="true" className={styles.chainOpportunityShotMapSummaryBeatPips}>
                    {Array.from({ length: summaryBeatCount }, (_, index) => (
                        <i
                            data-chain-shot-map-summary-pip={index + 1}
                            data-chain-shot-map-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
            </span>
            {rows.map((row) => (
                <span
                    data-chain-shot-map-focus={row.id === primaryActionId ? 'primary' : 'support'}
                    data-chain-shot-map-lane={row.id}
                    data-chain-shot-map-count={row.count}
                    data-chain-shot-map-role={row.role}
                    data-chain-shot-map-role-id={row.tone}
                    data-chain-shot-map-screen-cue={row.screenCue}
                    data-chain-shot-map-tone={row.tone}
                    key={row.id}
                >
                    <b>{row.shotLabel}</b>
                    <em>{row.count}</em>
                    <span aria-hidden="true" className={styles.chainOpportunityShotMapBeatPips}>
                        {Array.from({ length: Math.max(2, Math.min(5, row.count)) }, (_, index) => (
                            <i
                                data-chain-shot-map-pip={index + 1}
                                data-chain-shot-map-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <i>{row.detail}</i>
                </span>
            ))}
        </span>
    );
};

export default TileBoardChainOpportunityShotMap;
