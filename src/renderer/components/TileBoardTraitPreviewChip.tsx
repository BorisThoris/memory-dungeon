import type { CSSProperties } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';

interface TraitPreviewChipView {
    accessibleLabel: string;
    action: string;
    actionKind: string;
    actionTone: string;
    audio: string;
    beatCount: number;
    cashoutBeatCount: number;
    density: number;
    densityLabel: string | null;
    densityMeterFill: number;
    densityTone: string;
    eyebrow: string;
    kind: string;
    lines: string[];
    rewardHotText: string | null;
    screenCue: string;
    signalFill: number;
    signalLabel: string;
    source: string;
    summaryAction: string;
    summaryBeatCount: number;
    summaryDensityTone: string;
    summaryKind: string;
    summaryLabel: string;
    summaryLabelAccessible: string;
    summaryTone: string;
    tone: string;
}

interface TileBoardTraitPreviewChipProps {
    compact?: boolean;
    preview: TraitPreviewChipView | null;
}

const TileBoardTraitPreviewChip = ({ compact = false, preview }: TileBoardTraitPreviewChipProps) => {
    if (!preview) {
        return null;
    }

    const renderedLines = compact ? preview.lines.slice(0, 1) : preview.lines;

    return (
        <div
            aria-label={preview.accessibleLabel}
            className={styles.traitPreviewChip}
            data-preview-action={preview.action}
            data-preview-audio={preview.audio}
            data-preview-beats={preview.beatCount}
            data-preview-density={preview.density}
            data-preview-density-tone={preview.densityTone}
            data-preview-kind={preview.kind}
            data-preview-screen-cue={preview.screenCue}
            data-preview-source={preview.source}
            data-preview-signal-fill={preview.signalFill}
            data-preview-tone={preview.tone}
            data-preview-meter-fill={preview.densityMeterFill}
            data-testid="trait-preview-chip"
            role="status"
        >
            <span
                aria-label={preview.summaryLabelAccessible}
                className={styles.traitPreviewSummary}
                data-preview-summary-action={preview.summaryAction}
                data-preview-summary-beats={preview.beatCount}
                data-preview-summary-density-tone={preview.summaryDensityTone}
                data-preview-summary-kind={preview.summaryKind}
                data-preview-summary-tone={preview.summaryTone}
                data-testid="trait-preview-summary"
            >
                {compact ? null : <small>Preview</small>}
                <b>{preview.summaryLabel}</b>
                {preview.densityLabel ? <strong>{preview.densityLabel}</strong> : null}
                {compact ? null : <em>{preview.beatCount} beats</em>}
                {compact ? null : (
                    <span
                        aria-hidden="true"
                        className={styles.traitPreviewDensityMeter}
                        data-preview-meter-fill={preview.densityMeterFill}
                        style={{ '--trait-preview-meter-fill': `${preview.densityMeterFill}%` } as CSSProperties}
                    >
                        <i className={styles.traitPreviewDensityMeterFill} />
                    </span>
                )}
                {compact ? null : (
                    <FeedbackBeatPips
                        className={styles.traitPreviewSummaryBeatPips}
                        count={preview.summaryBeatCount}
                        itemProps={(beatIndex) => ({
                            'data-preview-summary-beat': beatIndex + 1,
                            'data-preview-summary-beat-action': preview.summaryAction,
                            'data-preview-summary-beat-density': preview.summaryDensityTone,
                            'data-preview-summary-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`${preview.kind}-summary-beat`}
                    />
                )}
            </span>
            <span className={styles.traitPreviewEyebrow}>{preview.eyebrow}</span>
            {compact ? null : <span className={styles.traitPreviewSignal}>{preview.signalLabel}</span>}
            {compact ? null : (
                <span
                    aria-hidden="true"
                    className={styles.traitPreviewSignalMeter}
                    data-preview-signal-fill={preview.signalFill}
                    style={{ '--trait-preview-signal-fill': `${preview.signalFill}%` } as CSSProperties}
                >
                    <i aria-hidden="true" className={styles.traitPreviewSignalMeterFill} />
                </span>
            )}
            {compact ? null : (
                <FeedbackBeatPips
                    className={styles.traitPreviewBeatPips}
                    count={preview.beatCount}
                    itemProps={(beatIndex) => ({
                        'data-preview-beat': beatIndex + 1,
                        'data-preview-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`${preview.kind}-preview-beat`}
                />
            )}
            <b className={styles.traitPreviewAction} data-preview-action-kind={preview.actionKind} data-preview-action-tone={preview.actionTone}>
                {preview.action}
                {compact ? null : (
                    <FeedbackBeatPips
                        className={styles.traitPreviewActionBeatPips}
                        count={preview.beatCount}
                        itemProps={(beatIndex) => ({
                            'data-preview-action-beat': beatIndex + 1,
                            'data-preview-action-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`${preview.action}-beat`}
                    />
                )}
            </b>
            {preview.rewardHotText && !compact ? (
                <span className={styles.traitPreviewCashout} data-preview-cashout-kind={preview.kind} data-preview-cashout-tone={preview.tone}>
                    Cashout / {preview.rewardHotText}
                    <FeedbackBeatPips
                        className={styles.traitPreviewCashoutBeatPips}
                        count={preview.cashoutBeatCount}
                        itemProps={(beatIndex) => ({
                            'data-preview-cashout-beat': beatIndex + 1,
                            'data-preview-cashout-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`${preview.rewardHotText}-beat`}
                    />
                </span>
            ) : null}
            {renderedLines.map((line, index) => (
                <span
                    className={styles.traitPreviewLine}
                    data-preview-line={index + 1}
                    data-preview-line-beats={index === 0 ? 3 : 2}
                    data-preview-line-focus={index === 0 ? 'primary' : 'support'}
                    data-preview-line-kind={preview.kind}
                    data-preview-line-tone={preview.tone}
                    key={line}
                >
                    {line}
                    {compact ? null : (
                        <FeedbackBeatPips
                            className={styles.traitPreviewLineBeatPips}
                            count={index === 0 ? 3 : 2}
                            itemProps={(beatIndex) => ({
                                'data-preview-line-beat': beatIndex + 1,
                                'data-preview-line-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                            })}
                            keyPrefix={`${line}-beat`}
                        />
                    )}
                </span>
            ))}
        </div>
    );
};

export default TileBoardTraitPreviewChip;
