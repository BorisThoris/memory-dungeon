import type { CSSProperties } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';

interface NextTargetCue {
    actionId: string;
    beatCount: number;
    target: string;
    tier: string;
    tone: string;
}

interface MilestoneCue {
    actionLabel: string;
    beatCount: number;
    meterFill: number;
    screenCue: string;
    targetLabel: string;
    tier: string;
    tone: string;
}

interface TargetPlanCue {
    actionId: string;
    beatCount: number;
    label: string;
    nextActionLabel: string;
    tier: string;
    tone: string;
}

interface SequenceCue {
    accessibleLabel: string;
    first: string;
    keep: string;
    then: string;
    tone: string;
}

interface TileBoardChainOpportunityProgressionCuesProps {
    followupLabel: string | null;
    milestone: MilestoneCue | null;
    nextTarget: NextTargetCue | null;
    sequenceCue: SequenceCue | null;
    targetPlan: TargetPlanCue | null;
    surgeLabel: string | null;
}

const TileBoardChainOpportunityProgressionCues = ({
    followupLabel,
    milestone,
    nextTarget,
    sequenceCue,
    targetPlan,
    surgeLabel
}: TileBoardChainOpportunityProgressionCuesProps) => (
    <>
        {nextTarget ? (
            <span
                className={styles.chainOpportunityTarget}
                data-chain-target-action={nextTarget.actionId}
                data-chain-target-tier={nextTarget.tier}
                data-chain-target-tone={nextTarget.tone}
                data-chain-opportunity-target={nextTarget.target}
            >
                {nextTarget.target}
                <FeedbackBeatPips
                    className={styles.chainOpportunityTargetBeatPips}
                    count={nextTarget.beatCount}
                    itemProps={(index) => ({
                        'data-chain-target-beat': index + 1,
                        'data-chain-target-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-target-${nextTarget.actionId}`}
                />
            </span>
        ) : null}
        {milestone ? (
            <span
                aria-label={`Chain milestone. ${milestone.actionLabel}: ${milestone.targetLabel}.`}
                className={styles.chainOpportunityMilestone}
                data-chain-milestone-meter-fill={milestone.meterFill}
                data-chain-milestone-screen-cue={milestone.screenCue}
                data-chain-milestone-tier={milestone.tier}
                data-chain-milestone-tone={milestone.tone}
                data-testid="chain-opportunity-milestone"
                style={
                    {
                        '--chain-milestone-meter-fill': `${milestone.meterFill}%`
                    } as CSSProperties
                }
            >
                <small>{milestone.actionLabel}</small>
                <b>{milestone.targetLabel}</b>
                <i aria-hidden="true" className={styles.chainOpportunityMilestoneMeter} data-testid="chain-opportunity-milestone-meter">
                    <i aria-hidden="true" className={styles.chainOpportunityMilestoneMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityMilestoneBeatPips}
                    count={milestone.beatCount}
                    itemProps={(index) => ({
                        'data-chain-milestone-beat': index + 1,
                        'data-chain-milestone-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-milestone-${milestone.actionLabel}`}
                />
            </span>
        ) : null}
        {targetPlan ? (
            <span
                aria-label={`Chain target plan. ${targetPlan.label}. Action: ${targetPlan.nextActionLabel}.`}
                className={styles.chainOpportunityTargetPlan}
                data-chain-target-plan-action={targetPlan.actionId}
                data-chain-target-plan-tier={targetPlan.tier}
                data-chain-target-plan-tone={targetPlan.tone}
                data-chain-opportunity-target-plan={targetPlan.label}
                data-testid="chain-opportunity-target-plan"
            >
                {targetPlan.label}
                <FeedbackBeatPips
                    className={styles.chainOpportunityTargetPlanBeatPips}
                    count={targetPlan.beatCount}
                    itemProps={(index) => ({
                        'data-chain-target-plan-beat': index + 1,
                        'data-chain-target-plan-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-target-plan-${targetPlan.actionId}`}
                />
            </span>
        ) : null}
        {sequenceCue ? (
            <span
                aria-label={sequenceCue.accessibleLabel}
                className={styles.chainOpportunitySequenceCue}
                data-chain-sequence-tone={sequenceCue.tone}
                data-testid="chain-opportunity-sequence-cue"
            >
                <span
                    aria-hidden="true"
                    className={styles.chainOpportunitySequenceStep}
                    data-chain-sequence-step="first"
                    data-chain-sequence-step-tone={sequenceCue.tone}
                >
                    <small>First</small>
                    <b>{sequenceCue.first}</b>
                </span>
                <span
                    aria-hidden="true"
                    className={styles.chainOpportunitySequenceStep}
                    data-chain-sequence-step="then"
                    data-chain-sequence-step-tone={sequenceCue.tone}
                >
                    <small>Then</small>
                    <b>{sequenceCue.then}</b>
                </span>
                <span
                    aria-hidden="true"
                    className={styles.chainOpportunitySequenceStep}
                    data-chain-sequence-step="keep"
                    data-chain-sequence-step-tone={sequenceCue.tone}
                >
                    <small>Keep</small>
                    <b>{sequenceCue.keep}</b>
                </span>
            </span>
        ) : null}
        {surgeLabel ? (
            <span
                aria-label={`Chain surge. ${surgeLabel}. 4 beats.`}
                className={styles.chainOpportunitySurge}
                data-chain-opportunity-surge-beats={4}
                data-chain-opportunity-surge-screen-cue="burst"
                data-chain-opportunity-surge="true"
                data-chain-opportunity-surge-tone="surge"
                data-testid="chain-opportunity-surge"
            >
                <b>{surgeLabel}</b>
                <FeedbackBeatPips
                    className={styles.chainOpportunitySurgeBeatPips}
                    count={4}
                    itemProps={(index) => ({
                        'data-chain-opportunity-surge-beat': index + 1,
                        'data-chain-opportunity-surge-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix="chain-surge"
                />
            </span>
        ) : null}
        {followupLabel ? (
            <span
                aria-label={`Next tap follow-up. ${followupLabel}. 3 beats.`}
                className={styles.chainOpportunityFollowup}
                data-chain-followup-action="Tap follow-up"
                data-chain-followup-meter-fill="100"
                data-chain-followup-beats={3}
                data-chain-followup-ready="true"
                data-chain-followup-screen-cue="pulse"
                data-chain-followup-tone="route"
                data-testid="chain-opportunity-followup-cue"
                style={{ '--chain-followup-meter-fill': '100%' } as CSSProperties}
            >
                <small>Next tap</small>
                <b>{followupLabel}</b>
                <i aria-hidden="true" className={styles.chainOpportunityFollowupMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityFollowupMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityFollowupBeatPips}
                    count={3}
                    itemProps={(index) => ({
                        'data-chain-followup-beat': index + 1,
                        'data-chain-followup-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix="chain-followup"
                />
            </span>
        ) : null}
    </>
);

export default TileBoardChainOpportunityProgressionCues;
