import type { CSSProperties, ReactNode } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';

interface OpportunityPayoffCrescendoView {
    beatCount: number;
    detail: string;
    fill: number;
    label: string;
    screenCue: string;
    tier: string;
}

interface OpportunityPayoffStackView {
    action: string;
    accessibleLabel: string;
    crescendo: OpportunityPayoffCrescendoView;
    crescendoAudio: string;
    cue: string;
    cueId: string;
    detail: string;
    fill: number;
    heat: string;
    nextCue: string;
    sequenceCue: string | null;
    sequenceFirst: string;
    sequenceKeep: string;
    sequenceThen: string;
    tone: string;
    value: string;
}

interface OpportunityCompassRowView {
    action: string;
    actionId: string;
    ariaLabel: string;
    audio: string;
    beatCount: number;
    detail: string;
    hazardAction: string;
    hazardFamily: string;
    hazardScreenCue: string;
    hazardTier: string;
    hazardTrigger: string;
    heat: string;
    id: string;
    impactCue: string;
    impactCueId: string | null;
    isBest: boolean;
    label: string;
    rowMeterFill: number;
    screenCue: string;
    tone: string;
    value: string;
}

interface TileBoardOpportunityCompassProps {
    bestScreenCue: string;
    bestTone: string;
    beats: number;
    children?: ReactNode;
    compact?: boolean;
    heat: string;
    hot: string;
    label: string;
    meterFill: number;
    payoffStack: OpportunityPayoffStackView | null;
    priority: string;
    rows: OpportunityCompassRowView[];
    summaryAction: string | null;
    summaryActionLabel: string;
    summaryBeatCount: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
    summaryTone: string;
    surge: string;
}

const TileBoardOpportunityCompass = ({
    bestScreenCue,
    bestTone,
    beats,
    children,
    compact = false,
    heat,
    hot,
    label,
    meterFill,
    payoffStack,
    priority,
    rows,
    summaryAction,
    summaryActionLabel,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier,
    summaryTone,
    surge
}: TileBoardOpportunityCompassProps) => {
    if (rows.length === 0) {
        return null;
    }

    const renderedRows = compact ? rows.filter((row) => row.isBest).slice(0, 1) : rows;

    return (
        <div
            aria-label={label}
            className={styles.opportunityCompass}
            data-opportunity-compass-best-screen-cue={bestScreenCue}
            data-opportunity-compass-best-tone={bestTone}
            data-opportunity-compass-heat={heat}
            data-opportunity-compass-hot={hot}
            data-opportunity-compass-surge={surge}
            data-opportunity-compass-beats={beats}
            data-opportunity-compass-priority={priority}
            data-opportunity-compass-summary-action={summaryAction ?? 'none'}
            data-opportunity-compass-summary-action-label={summaryActionLabel}
            data-opportunity-compass-summary-beats={summaryBeatCount}
            data-opportunity-compass-summary-screen-cue={summaryScreenCue ?? 'none'}
            data-opportunity-compass-summary-tier={summaryTier ?? 'none'}
            data-testid="board-opportunity-compass"
            role="group"
        >
            <span
                aria-label={`Opportunity summary. ${rows.length} ${rows.length === 1 ? 'play' : 'plays'}. Best action: ${summaryActionLabel}.`}
                className={styles.opportunityCompassSummary}
                data-opportunity-compass-summary-action={summaryAction ?? 'none'}
                data-opportunity-compass-summary-action-label={summaryActionLabel}
                data-opportunity-compass-summary-beats={summaryBeatCount}
                data-opportunity-compass-summary-screen-cue={summaryScreenCue ?? 'none'}
                data-opportunity-compass-summary-tier={summaryTier ?? 'none'}
                data-opportunity-compass-summary-tone={summaryTone}
                data-testid="board-opportunity-compass-summary"
            >
                {compact ? null : <small>{rows.length === 1 ? 'Only' : 'Best'}</small>}
                <b>
                    {rows.length} {rows.length === 1 ? 'play' : 'plays'}
                </b>
                {compact ? null : (
                    <FeedbackBeatPips
                        className={styles.opportunityCompassSummaryBeatPips}
                        count={summaryBeatCount}
                        itemProps={(index) => ({
                            'data-opportunity-compass-summary-beat': index + 1,
                            'data-opportunity-compass-summary-beat-action': summaryAction ?? 'none',
                            'data-opportunity-compass-summary-beat-focus': index === 0 ? 'primary' : 'support'
                        })}
                        keyPrefix={`opportunity-summary-${summaryAction ?? 'none'}`}
                    />
                )}
            </span>
            {compact ? null : (
                <i
                    aria-hidden="true"
                    className={styles.opportunityCompassMeter}
                    data-opportunity-compass-meter-fill={meterFill}
                    data-testid="board-opportunity-compass-meter"
                    style={
                        {
                            '--opportunity-compass-meter-fill': `${meterFill}%`
                        } as CSSProperties
                    }
                >
                    <i aria-hidden="true" className={styles.opportunityCompassMeterFill} />
                </i>
            )}
            {payoffStack ? (
                <span
                    aria-label={payoffStack.accessibleLabel}
                    className={styles.opportunityPayoffStack}
                    data-payoff-stack-crescendo-audio={payoffStack.crescendoAudio}
                    data-payoff-stack-crescendo-beats={payoffStack.crescendo.beatCount}
                    data-payoff-stack-crescendo-cue={payoffStack.crescendo.screenCue}
                    data-payoff-stack-crescendo-screen-cue={payoffStack.crescendo.screenCue}
                    data-payoff-stack-crescendo-tier={payoffStack.crescendo.tier}
                    data-payoff-stack-cue-id={payoffStack.cueId}
                    data-payoff-stack-heat={payoffStack.heat}
                    data-payoff-stack-sequence-first={payoffStack.sequenceFirst}
                    data-payoff-stack-sequence-keep={payoffStack.sequenceKeep}
                    data-payoff-stack-sequence-then={payoffStack.sequenceThen}
                    data-payoff-stack-tone={payoffStack.tone}
                    data-payoff-stack-fill={payoffStack.fill}
                    data-testid="board-opportunity-payoff-stack"
                    style={
                        {
                            '--payoff-stack-fill': `${payoffStack.fill}%`
                        } as CSSProperties
                    }
                >
                    <small data-payoff-stack-cue={payoffStack.cue} data-payoff-stack-cue-id={payoffStack.cueId}>
                        {payoffStack.cue}
                    </small>
                    <span>{payoffStack.action}</span>
                    <strong>{payoffStack.value}</strong>
                    {compact ? null : <u>{payoffStack.tone === 'cashout' ? 'Hit now' : 'Prime payoff'}</u>}
                    {compact ? null : <b>{payoffStack.detail}</b>}
                    <i aria-hidden="true" className={styles.opportunityPayoffStackMeter} />
                    {compact ? null : (
                        <span
                            aria-label={`Payoff crescendo meter. ${payoffStack.crescendo.label}. ${payoffStack.crescendo.detail}. ${payoffStack.crescendo.beatCount} beats.`}
                            aria-valuemax={100}
                            aria-valuemin={0}
                            aria-valuenow={payoffStack.crescendo.fill}
                            className={styles.opportunityPayoffCrescendo}
                            data-payoff-stack-crescendo-label={payoffStack.crescendo.label}
                            data-payoff-stack-crescendo-fill={payoffStack.crescendo.fill}
                            style={
                                {
                                    '--payoff-stack-crescendo-fill': `${payoffStack.crescendo.fill}%`
                                } as CSSProperties
                            }
                            role="progressbar"
                        >
                            <small>{payoffStack.crescendo.label}</small>
                            <FeedbackBeatPips
                                containerTag="strong"
                                count={payoffStack.crescendo.beatCount}
                                itemProps={(index) => ({
                                    'data-payoff-stack-crescendo-beat': index + 1,
                                    'data-payoff-stack-crescendo-beat-focus': index === 0 ? 'primary' : 'support'
                                })}
                                keyPrefix={`payoff-crescendo-${payoffStack.crescendo.label}`}
                            />
                            <em>{payoffStack.crescendo.detail}</em>
                            <i aria-hidden="true" className={styles.opportunityPayoffCrescendoMeter}>
                                <i aria-hidden="true" className={styles.opportunityPayoffCrescendoMeterFill} />
                            </i>
                        </span>
                    )}
                    <em data-payoff-stack-sequence-step="first">{payoffStack.nextCue}</em>
                    {compact ? null : payoffStack.sequenceCue ? <i data-payoff-stack-sequence-step="then">{payoffStack.sequenceCue}</i> : null}
                    {compact ? null : <i data-payoff-stack-sequence-step="keep">Keep: {payoffStack.sequenceKeep}</i>}
                    {compact ? null : (
                        <FeedbackBeatPips
                            className={styles.opportunityPayoffStackBeatPips}
                            count={payoffStack.crescendo.beatCount}
                            itemProps={(index) => ({
                                'data-opportunity-payoff-beat': index + 1,
                                'data-opportunity-payoff-beat-focus': index === 0 ? 'primary' : 'support'
                            })}
                            keyPrefix={`payoff-stack-${payoffStack.action}`}
                        />
                    )}
                </span>
            ) : null}
            {children}
            {renderedRows.map((row) => (
                <span
                    aria-label={row.ariaLabel}
                    className={styles.opportunityCompassRow}
                    data-opportunity-action-id={row.actionId}
                    data-opportunity-audio={row.audio}
                    data-opportunity-beats={row.beatCount}
                    data-opportunity-row-meter-fill={row.rowMeterFill}
                    data-opportunity-heat={row.heat}
                    data-hazard-opportunity-action={row.hazardAction}
                    data-hazard-opportunity-family={row.hazardFamily}
                    data-hazard-opportunity-screen-cue={row.hazardScreenCue}
                    data-hazard-opportunity-tier={row.hazardTier}
                    data-hazard-opportunity-trigger={row.hazardTrigger}
                    data-opportunity-impact-cue={row.impactCue}
                    data-opportunity-impact-cue-id={row.impactCueId ?? 'none'}
                    data-opportunity-priority={row.isBest ? 'best' : 'normal'}
                    data-opportunity-tone={row.tone}
                    data-opportunity-screen-cue={row.screenCue}
                    data-testid={`board-opportunity-${row.id}`}
                    style={
                        {
                            '--opportunity-compass-row-meter-fill': `${row.rowMeterFill}%`
                        } as CSSProperties
                    }
                    key={`${row.id}:${row.value}`}
                >
                    {row.isBest ? <span className={styles.opportunityCompassPriority}>Best</span> : null}
                    <span className={styles.opportunityCompassImpact}>{row.impactCue}</span>
                    {compact ? null : (
                        <FeedbackBeatPips
                            className={styles.opportunityCompassBeatPips}
                            count={row.beatCount}
                            itemProps={(beatIndex) => ({
                                'data-opportunity-beat': beatIndex + 1,
                                'data-opportunity-beat-focus': beatIndex === 0 ? 'primary' : 'support'
                            })}
                            keyPrefix={`opportunity-row-${row.id}-${row.actionId}`}
                        />
                    )}
                    <b>{row.action}</b>
                    {compact ? null : <small>{row.label}</small>}
                    <strong>{row.value}</strong>
                    {compact ? null : <em>{row.detail}</em>}
                </span>
            ))}
        </div>
    );
};

export default TileBoardOpportunityCompass;
