import styles from './TileBoard.module.css';

type ActionPriorityRole = 'Bank' | 'Cashout' | 'Follow-up' | 'Perk' | 'Setup';
type ActionPriorityTone = 'bank' | 'cashout' | 'followup' | 'perk' | 'setup';
type ActionPriorityScreenCue = 'burst' | 'guard' | 'pulse' | 'tick';

interface ChainOpportunityActionPriorityRow {
    count: number;
    id: string;
    label: string;
    role: ActionPriorityRole;
    screenCue: ActionPriorityScreenCue;
    tone: ActionPriorityTone;
}

interface TileBoardChainOpportunityActionPriorityProps {
    primaryActionId: string;
    primaryRow: ChainOpportunityActionPriorityRow | null;
    rows: ChainOpportunityActionPriorityRow[];
    summaryAction: ActionPriorityTone | null;
    summaryBeatCount: 2 | 3 | 4 | 5;
    summaryScreenCue: ActionPriorityScreenCue | null;
    summaryTier: ActionPriorityTone | null;
}

const TileBoardChainOpportunityActionPriority = ({
    primaryActionId,
    primaryRow,
    rows,
    summaryAction,
    summaryBeatCount,
    summaryScreenCue,
    summaryTier
}: TileBoardChainOpportunityActionPriorityProps) => {
    if (rows.length === 0) {
        return null;
    }

    return (
        <span
            aria-label={`Card action priority. ${rows.map((row) => `${row.label}: ${row.count}`).join('. ')}`}
            className={styles.chainOpportunityActionPriority}
            data-card-action-primary={primaryActionId}
            data-card-action-primary-role={primaryRow?.role ?? 'none'}
            data-card-action-primary-role-id={primaryRow?.tone ?? 'none'}
            data-card-action-primary-screen-cue={primaryRow?.screenCue ?? 'none'}
            data-card-action-primary-tone={primaryRow?.tone ?? 'none'}
            data-card-action-priority-summary-action={summaryAction ?? 'none'}
            data-card-action-priority-summary-beats={summaryBeatCount}
            data-card-action-priority-summary-screen-cue={summaryScreenCue ?? 'none'}
            data-card-action-priority-summary-tier={summaryTier ?? 'none'}
            data-testid="chain-opportunity-action-priority"
        >
            <small>Priority</small>
            <span
                aria-label={`Action priority summary. ${rows.length} ${rows.length === 1 ? 'lane' : 'lanes'}. ${summaryAction ?? 'No action'}.`}
                className={styles.chainOpportunityActionPrioritySummary}
                data-card-action-priority-summary-action={summaryAction ?? 'none'}
                data-card-action-priority-summary-beats={summaryBeatCount}
                data-card-action-priority-summary-screen-cue={summaryScreenCue ?? 'none'}
                data-card-action-priority-summary-tier={summaryTier ?? 'none'}
                data-testid="chain-opportunity-action-priority-summary"
            >
                <small>Actions</small>
                <b>
                    {rows.length} {rows.length === 1 ? 'lane' : 'lanes'}
                </b>
                <span aria-hidden="true" className={styles.chainOpportunityActionPrioritySummaryBeatPips}>
                    {Array.from({ length: summaryBeatCount }, (_, index) => (
                        <i
                            data-card-action-priority-summary-pip={index + 1}
                            data-card-action-priority-summary-pip-focus={index === 0 ? 'primary' : 'support'}
                            key={index}
                        />
                    ))}
                </span>
            </span>
            {rows.map((row) => (
                <span
                    aria-label={`Card action priority row. ${row.label}. ${row.role}. ${row.count}.`}
                    data-card-action-priority={row.id}
                    data-card-action-priority-count={row.count}
                    data-card-action-priority-focus={row.id === primaryActionId ? 'primary' : 'support'}
                    data-card-action-priority-role={row.role}
                    data-card-action-priority-role-id={row.tone}
                    data-card-action-priority-screen-cue={row.screenCue}
                    data-card-action-priority-tone={row.tone}
                    key={row.id}
                >
                    <b>{row.label}</b>
                    <em>{row.count}</em>
                    <span aria-hidden="true" className={styles.chainOpportunityActionPriorityPips}>
                        {Array.from({ length: Math.max(1, Math.min(5, row.count)) }, (_, index) => (
                            <i
                                data-card-action-priority-pip={index + 1}
                                data-card-action-priority-pip-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                </span>
            ))}
        </span>
    );
};

export default TileBoardChainOpportunityActionPriority;
