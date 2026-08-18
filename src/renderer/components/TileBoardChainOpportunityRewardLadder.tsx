import type { CSSProperties } from 'react';
import styles from './TileBoard.module.css';

interface RewardLadderEntryView {
    action: string;
    ariaLabel: string;
    audioCue: string;
    beatCount: number;
    chaseLabel: string;
    fillPercent: number;
    filled: number;
    focus: 'primary' | 'support';
    id: string;
    isFocus: boolean;
    label: string;
    progressLabel: string;
    remainingLabel: string;
    screenCue: string;
    tone: string;
    total: number;
    urgency: string;
}

interface RewardLeadView {
    action: string;
    audioCue: string;
    beatCount: number;
    chaseLabel: string;
    label: string;
    meterFill: number;
    progressLabel: string;
    remainingLabel: string;
    screenCue: string;
    tier: string;
    tone: string;
    urgencyLabel: string;
}

interface TileBoardChainOpportunityRewardLadderProps {
    accessibleLabel: string;
    entries: RewardLadderEntryView[];
    focusId: string | null;
    hotBandTone: string;
    ladderActionAttr: string;
    ladderAttr: string;
    lead: RewardLeadView | null;
    leadAccessibleLabel?: string;
    summaryAction: string | null;
    summaryBeatCount: number;
    summaryMeterFill: number;
    summaryScreenCue: string | null;
    summaryTier: string | null;
}

const TileBoardChainOpportunityRewardLadder = ({
    accessibleLabel,
    entries,
    focusId,
    hotBandTone,
    ladderActionAttr,
    ladderAttr,
    lead,
    leadAccessibleLabel,
    summaryAction,
    summaryBeatCount,
    summaryMeterFill,
    summaryScreenCue,
    summaryTier
}: TileBoardChainOpportunityRewardLadderProps) => {
    if (entries.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={accessibleLabel}
            className={styles.chainOpportunityRewardLadder}
            data-board-chain-reward-ladder-actions={ladderActionAttr}
            data-board-chain-reward-ladder={ladderAttr}
            data-board-chain-reward-ladder-focus={focusId ?? 'none'}
            data-board-chain-reward-hot-band={hotBandTone}
            data-board-chain-reward-ladder-summary-action={summaryAction ?? 'none'}
            data-board-chain-reward-ladder-summary-beats={summaryBeatCount}
            data-board-chain-reward-ladder-summary-screen-cue={summaryScreenCue ?? 'none'}
            data-board-chain-reward-ladder-summary-tier={summaryTier ?? 'none'}
            data-testid="chain-opportunity-reward-ladder"
        >
            <span
                aria-label={`Reward ladder summary. ${entries.length} ${entries.length === 1 ? 'reward' : 'rewards'}. ${
                    summaryAction ?? 'No action'
                }.`}
                className={styles.chainOpportunityRewardLadderSummary}
                data-board-chain-reward-ladder-summary-action={summaryAction ?? 'none'}
                data-board-chain-reward-ladder-summary-beats={summaryBeatCount}
                data-board-chain-reward-ladder-summary-meter-fill={summaryMeterFill}
                data-board-chain-reward-ladder-summary-screen-cue={summaryScreenCue ?? 'none'}
                data-board-chain-reward-ladder-summary-tier={summaryTier ?? 'none'}
                data-testid="chain-opportunity-reward-ladder-summary"
                style={
                    {
                        '--board-chain-reward-ladder-summary-meter-fill': `${summaryMeterFill}%`
                    } as CSSProperties
                }
            >
                <small>Rewards</small>
                <b>
                    {entries.length} {entries.length === 1 ? 'reward' : 'rewards'}
                </b>
                <i aria-hidden="true" className={styles.chainOpportunityRewardLadderSummaryMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityRewardLadderSummaryMeterFill} />
                </i>
                <span aria-hidden="true" className={styles.chainOpportunityRewardLadderSummaryBeatPips}>
                    {Array.from({ length: summaryBeatCount }, (_, index) => (
                        <i
                            data-board-chain-reward-summary-beat={index + 1}
                            data-board-chain-reward-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
            </span>
            {lead ? (
                <span
                    aria-label={leadAccessibleLabel}
                    className={styles.chainOpportunityRewardLead}
                    data-board-chain-reward-lead-tier={lead.tier}
                    data-board-chain-reward-lead-meter-fill={lead.meterFill}
                    data-board-chain-reward-lead-action={lead.action}
                    data-board-chain-reward-lead-audio={lead.audioCue}
                    data-board-chain-reward-lead-screen-cue={lead.screenCue}
                    data-board-chain-reward-lead-tone={lead.tone}
                    data-testid="chain-opportunity-reward-lead"
                    style={
                        {
                            '--board-chain-reward-lead-meter-fill': `${lead.meterFill}%`
                        } as CSSProperties
                    }
                >
                    <small>{lead.urgencyLabel}</small>
                    <b>{lead.chaseLabel}</b>
                    <strong>{lead.action}</strong>
                    <em>{lead.label}</em>
                    <i>{lead.progressLabel}</i>
                    <small>{lead.remainingLabel}</small>
                    <i aria-hidden="true" className={styles.chainOpportunityRewardLeadMeter}>
                        <i aria-hidden="true" className={styles.chainOpportunityRewardLeadMeterFill} />
                    </i>
                    <span aria-hidden="true" className={styles.chainOpportunityRewardLeadBeatPips}>
                        {Array.from({ length: lead.beatCount }, (_, index) => (
                            <i
                                data-board-chain-reward-lead-beat={index + 1}
                                data-board-chain-reward-lead-beat-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                </span>
            ) : null}
            {entries.map((entry) => (
                <span
                    aria-label={entry.ariaLabel}
                    data-board-chain-reward-action={entry.action}
                    data-board-chain-reward-audio={entry.audioCue}
                    data-board-chain-reward-beats={entry.beatCount}
                    data-board-chain-reward-filled={entry.filled}
                    data-board-chain-reward-focus={entry.focus}
                    data-board-chain-reward-screen-cue={entry.screenCue}
                    data-board-chain-reward-tone={entry.tone}
                    data-board-chain-reward-total={entry.total}
                    data-board-chain-reward-urgency={entry.urgency}
                    data-testid={entry.isFocus ? 'chain-opportunity-reward-ladder-focus' : undefined}
                    key={entry.id}
                    style={{ '--board-chain-reward-fill': `${entry.fillPercent}%` } as CSSProperties}
                >
                    <small>{entry.chaseLabel}</small>
                    {entry.action !== entry.chaseLabel ? <strong>{entry.action}</strong> : null}
                    <b>{entry.label}</b>
                    <em>{entry.progressLabel}</em>
                    <i>{entry.remainingLabel}</i>
                    <span aria-hidden="true" className={styles.chainOpportunityRewardBeatPips}>
                        {Array.from({ length: entry.beatCount }, (_, beatIndex) => (
                            <i
                                data-board-chain-reward-beat={beatIndex + 1}
                                data-board-chain-reward-beat-focus={beatIndex === 0 ? 'primary' : 'support'}
                                key={`${entry.id}-reward-beat-${beatIndex + 1}`}
                            />
                        ))}
                    </span>
                </span>
            ))}
        </span>
    );
};

export default TileBoardChainOpportunityRewardLadder;
