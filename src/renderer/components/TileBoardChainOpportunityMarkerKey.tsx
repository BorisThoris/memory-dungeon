import { type CSSProperties } from 'react';
import styles from './TileBoard.module.css';

type MarkerKeySummaryAction = 'cashout' | 'followup' | 'perk' | 'prime' | 'route' | 'surge';
type MarkerKeySummaryTier = 'cashout' | 'perk' | 'ready' | 'setup' | 'stack' | 'surge';
type MarkerShapeId =
    | 'combo-surge'
    | 'followup-target'
    | 'linked-route'
    | 'payoff-bar'
    | 'payoff-stack'
    | 'perk-armed-bar'
    | 'swap-target-crossbar'
    | 'none';
type MarkerIntensityId = 'cashout' | 'ready' | 'setup' | 'stack' | 'surge';

interface ChainOpportunityMarkerKeyRow {
    action: string;
    count: number;
    glyph: string;
    id: string;
    label: string;
    shape: Exclude<MarkerShapeId, 'none'>;
}

interface ChainOpportunityMarkerIntensity {
    action: string;
    count: number;
    id: MarkerIntensityId;
    label: string;
}

interface TileBoardChainOpportunityMarkerKeyProps {
    focusedChainMarkerShape: MarkerShapeId;
    intensity: ChainOpportunityMarkerIntensity | null;
    rows: ChainOpportunityMarkerKeyRow[];
    summaryAction: MarkerKeySummaryAction | null;
    summaryBeatCount: 2 | 3 | 4 | 5;
    summaryMeterFill: number;
    summaryScreenCue: 'burst' | 'guard' | 'pulse' | 'snap' | 'tick' | null;
    summaryTier: MarkerKeySummaryTier | null;
}

const TileBoardChainOpportunityMarkerKey = ({
    focusedChainMarkerShape,
    intensity,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: TileBoardChainOpportunityMarkerKeyProps) => {
    if (rows.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={`Trait marker key. ${[
                ...rows.map(
                    (row) => `${row.label}: ${row.glyph}. ${row.count} ${row.count === 1 ? 'card' : 'cards'}. Action: ${row.action}`
                ),
                intensity ? `Intensity: ${intensity.label} ${intensity.count}. Action: ${intensity.action}` : null
            ]
                .filter((row): row is string => row != null)
                .join('. ')}`}
            className={styles.chainOpportunityMarkerKey}
            data-chain-marker-key-action={summaryAction ?? 'none'}
            data-chain-marker-key-beats={summaryBeatCount}
            data-chain-marker-focused-shape={focusedChainMarkerShape}
            data-chain-marker-intensity={intensity?.id ?? 'none'}
            data-chain-marker-key-screen-cue={summaryScreenCue ?? 'none'}
            data-chain-marker-key-tier={summaryTier ?? 'none'}
            data-testid="chain-opportunity-marker-key"
        >
            <span
                aria-label={`Trait marker summary. ${rows.length} marker cues. ${summaryAction ?? 'No action'}.`}
                className={styles.chainOpportunityMarkerKeySummary}
                data-chain-marker-key-action={summaryAction ?? 'none'}
                data-chain-marker-key-beats={summaryBeatCount}
                data-testid="chain-opportunity-marker-key-summary"
                data-chain-marker-key-meter-fill={summaryMeterFill}
                data-chain-marker-key-screen-cue={summaryScreenCue ?? 'none'}
                data-chain-marker-key-tier={summaryTier ?? 'none'}
                style={
                    {
                        '--chain-marker-key-meter-fill': `${summaryMeterFill}%`
                    } as CSSProperties
                }
            >
                <small>Trait glyphs</small>
                <b>{rows.length} cues</b>
                <span aria-hidden="true" className={styles.chainOpportunityMarkerKeySummaryBeatPips}>
                    {Array.from({ length: summaryBeatCount }, (_, index) => (
                        <i
                            data-chain-marker-key-summary-beat={index + 1}
                            data-chain-marker-key-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
                <i aria-hidden="true" className={styles.chainOpportunityMarkerKeyMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityMarkerKeyMeterFill} />
                </i>
            </span>
            {rows.map((row) => (
                <span
                    data-chain-marker-focus={row.shape === focusedChainMarkerShape ? 'primary' : 'support'}
                    data-chain-marker-shape={row.shape}
                    key={row.id}
                >
                    <b aria-hidden="true">{row.glyph}</b>
                    <small>{row.label}</small>
                    <strong>x{row.count}</strong>
                    <em>{row.action}</em>
                </span>
            ))}
            {intensity ? (
                <span
                    aria-label={`Trait marker intensity. ${intensity.count} ${intensity.label}. ${intensity.action}.`}
                    data-chain-marker-intensity-chip={intensity.id}
                    data-testid="chain-marker-intensity"
                >
                    <b aria-hidden="true">{intensity.count}</b>
                    <small>{intensity.label}</small>
                    <em>{intensity.action}</em>
                    <span aria-hidden="true" className={styles.chainOpportunityMarkerIntensityPips}>
                        {Array.from({ length: Math.max(2, Math.min(5, intensity.count + 1)) }, (_, index) => (
                            <i
                                data-chain-marker-intensity-pip={index + 1}
                                data-chain-marker-intensity-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                </span>
            ) : null}
        </span>
    );
};

export default TileBoardChainOpportunityMarkerKey;
