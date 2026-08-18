import type { CSSProperties } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';

interface ArmedPerkMeter {
    beatCount: number;
    label: string;
    meterFill: number;
    payoff: string | null;
    tone: string;
    valueNow: number;
}

interface RewardUrgencyMeter {
    beatCount: number;
    label: string;
    meterFill: number;
    screenCue: string;
    tier: string;
    tone: string;
}

interface ExamplesMeter {
    beatCount: number;
    items: string[];
    meterFill: number;
    tone: string;
}

interface RewardCueMeter {
    beatCount: number;
    cue: string;
    hot: boolean;
    meterFill: number;
    screenCue: string;
    target: string;
    tone: string;
}

interface StatusBand {
    accessibleLabel?: string;
    action: string;
    beatCount: number;
    cue: string;
    detail: string;
    label: string;
    meterFill: number;
    screenCue: string;
    tier: string;
    tone: string;
    value: string;
}

interface MomentumMeter {
    beatCount: number;
    chaseLabel: string | null;
    label: string | null;
    meterFill: number;
    screenCue: string;
    tier: string;
    tone: string;
}

interface LinesMeter {
    action: string;
    beatCount: number;
    items: string[];
    meterFill: number;
    tier: string;
    tone: string;
}

interface TileBoardChainOpportunityStatusMetersProps {
    armedPerk: ArmedPerkMeter | null;
    examples: ExamplesMeter | null;
    hotBand: StatusBand | null;
    lines: LinesMeter;
    momentum: MomentumMeter | null;
    rewardCue: RewardCueMeter | null;
    rewardUrgency: RewardUrgencyMeter | null;
    surgeBand: StatusBand | null;
}

const TileBoardChainOpportunityStatusMeters = ({
    armedPerk,
    examples,
    hotBand,
    lines,
    momentum,
    rewardCue,
    rewardUrgency,
    surgeBand
}: TileBoardChainOpportunityStatusMetersProps) => (
    <>
        {armedPerk ? (
            <span
                aria-label={`Armed perk meter. ${armedPerk.label}. ${armedPerk.payoff ? 'Payoff ready' : 'Ready'}.`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={armedPerk.valueNow}
                className={styles.chainOpportunityArmedPerk}
                data-chain-armed-perk-meter-fill={armedPerk.meterFill}
                data-chain-armed-perk-tone={armedPerk.tone}
                data-chain-perk-armed="true"
                role="progressbar"
            >
                <small>{armedPerk.payoff ? 'Payoff' : 'Ready'}</small>
                <b>{armedPerk.label}</b>
                {armedPerk.payoff ? <em>{armedPerk.payoff}</em> : null}
                <i
                    aria-hidden="true"
                    className={styles.chainOpportunityArmedPerkMeter}
                    style={
                        {
                            '--chain-armed-perk-meter-fill': `${armedPerk.meterFill}%`
                        } as CSSProperties
                    }
                >
                    <i aria-hidden="true" className={styles.chainOpportunityArmedPerkMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityArmedPerkBeatPips}
                    count={armedPerk.beatCount}
                    itemProps={(index) => ({
                        'data-chain-armed-perk-beat': index + 1,
                        'data-chain-armed-perk-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-armed-perk-${armedPerk.label}`}
                />
            </span>
        ) : null}
        {rewardUrgency ? (
            <span
                aria-label={`Reward urgency meter. ${rewardUrgency.label}.`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={rewardUrgency.meterFill}
                className={styles.chainOpportunityRewardUrgency}
                data-chain-reward-urgency={rewardUrgency.tier}
                data-chain-reward-urgency-meter-fill={rewardUrgency.meterFill}
                data-chain-reward-urgency-screen-cue={rewardUrgency.screenCue}
                data-chain-reward-urgency-tier={rewardUrgency.tier}
                data-chain-reward-urgency-tone={rewardUrgency.tone}
                style={
                    {
                        '--chain-reward-urgency-meter-fill': `${rewardUrgency.meterFill}%`
                    } as CSSProperties
                }
                role="progressbar"
            >
                <small>{rewardUrgency.label}</small>
                <i aria-hidden="true" className={styles.chainOpportunityRewardUrgencyMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityRewardUrgencyMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityRewardUrgencyBeatPips}
                    count={rewardUrgency.beatCount}
                    itemProps={(index) => ({
                        'data-chain-reward-urgency-beat': index + 1,
                        'data-chain-reward-urgency-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-reward-urgency-${rewardUrgency.tier}`}
                />
            </span>
        ) : null}
        {examples ? (
            <span
                aria-label={`Chain examples meter. ${examples.items.length} ${examples.items.length === 1 ? 'example' : 'examples'}.`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={examples.meterFill}
                className={styles.chainOpportunityExamples}
                data-chain-examples-meter-fill={examples.meterFill}
                data-chain-examples-tone={examples.tone}
                style={
                    {
                        '--chain-examples-meter-fill': `${examples.meterFill}%`
                    } as CSSProperties
                }
                role="progressbar"
            >
                <small>Examples</small>
                {examples.items.join(' / ')}
                <i aria-hidden="true" className={styles.chainOpportunityExamplesMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityExamplesMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityExamplesBeatPips}
                    count={examples.beatCount}
                    itemProps={(index) => ({
                        'data-chain-examples-beat': index + 1,
                        'data-chain-examples-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-examples-${examples.tone}`}
                />
            </span>
        ) : null}
        {rewardCue ? (
            <span
                aria-label={`Chain reward meter. ${rewardCue.cue}. ${rewardCue.hot ? 'Cash in now' : 'Build toward cashout'}.`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={rewardCue.meterFill}
                className={rewardCue.hot ? styles.chainOpportunityPayoffBurst : styles.chainOpportunityRewardCue}
                data-chain-reward-beats={rewardCue.beatCount}
                data-chain-reward-hot={rewardCue.hot ? 'true' : 'false'}
                data-chain-reward-meter-fill={rewardCue.meterFill}
                data-chain-reward-target={rewardCue.target}
                data-chain-reward-screen-cue={rewardCue.screenCue}
                data-chain-reward-tone={rewardCue.tone}
                style={
                    {
                        '--chain-reward-meter-fill': `${rewardCue.meterFill}%`
                    } as CSSProperties
                }
                role="progressbar"
            >
                <small>{rewardCue.hot ? 'Payoff' : 'Forecast'}</small>
                <b>{rewardCue.cue}</b>
                <em>{rewardCue.hot ? 'Cash in now' : 'Build toward cashout'}</em>
                <i aria-hidden="true" className={styles.chainOpportunityRewardMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityRewardMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={rewardCue.hot ? styles.chainOpportunityPayoffBeatPips : styles.chainOpportunityRewardCueBeatPips}
                    count={rewardCue.beatCount}
                    itemProps={(index) => ({
                        'data-chain-reward-beat': index + 1,
                        'data-chain-reward-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-reward-${rewardCue.target}`}
                />
            </span>
        ) : null}
        {hotBand ? (
            <span
                aria-label={hotBand.accessibleLabel}
                className={styles.chainOpportunityHotBand}
                data-chain-hot-band-action={hotBand.action}
                data-chain-hot-band-beats={hotBand.beatCount}
                data-chain-hot-band-screen-cue={hotBand.screenCue}
                data-chain-hot-band-tier={hotBand.tier}
                data-chain-hot-band-tone={hotBand.tone}
                data-chain-hot-band-meter-fill={hotBand.meterFill}
                data-testid="chain-opportunity-hot-band"
                role="status"
            >
                <small>{hotBand.label}</small>
                <b>{hotBand.value}</b>
                <em>{hotBand.detail}</em>
                <i>{hotBand.cue}</i>
                <i
                    aria-hidden="true"
                    className={styles.chainOpportunityHotBandMeter}
                    data-chain-hot-band-meter-fill={hotBand.meterFill}
                    style={
                        {
                            '--chain-hot-band-meter-fill': `${hotBand.meterFill}%`
                        } as CSSProperties
                    }
                >
                    <i aria-hidden="true" className={styles.chainOpportunityHotBandMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityHotBandBeatPips}
                    count={hotBand.beatCount}
                    itemProps={(index) => ({
                        'data-chain-hot-band-beat': index + 1,
                        'data-chain-hot-band-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-hot-band-${hotBand.action}`}
                />
            </span>
        ) : null}
        {surgeBand ? (
            <span
                aria-label={surgeBand.accessibleLabel}
                className={styles.chainOpportunitySurgeBand}
                data-chain-surge-band-action={surgeBand.action}
                data-chain-surge-band-beats={surgeBand.beatCount}
                data-chain-surge-band-screen-cue={surgeBand.screenCue}
                data-chain-surge-band-tier={surgeBand.tier}
                data-chain-surge-band-tone={surgeBand.tone}
                data-chain-surge-band-meter-fill={surgeBand.meterFill}
                data-testid="chain-opportunity-surge-band"
                role="status"
                style={{ '--chain-surge-band-meter-fill': `${surgeBand.meterFill}%` } as CSSProperties}
            >
                <small>{surgeBand.label}</small>
                <b>{surgeBand.value}</b>
                <em>{surgeBand.detail}</em>
                <i>{surgeBand.cue}</i>
                <i aria-hidden="true" className={styles.chainOpportunitySurgeBandMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunitySurgeBandMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunitySurgeBandBeatPips}
                    count={surgeBand.beatCount}
                    itemProps={(index) => ({
                        'data-chain-surge-band-beat': index + 1,
                        'data-chain-surge-band-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-surge-band-${surgeBand.action}`}
                />
            </span>
        ) : null}
        {momentum ? (
            <span
                aria-label={`Chain momentum meter. ${momentum.label ?? momentum.chaseLabel ?? 'Momentum'}.`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={momentum.meterFill}
                className={styles.chainOpportunityMomentum}
                data-chain-momentum-beats={momentum.beatCount}
                data-chain-momentum-meter-fill={momentum.meterFill}
                data-chain-momentum-screen-cue={momentum.screenCue}
                data-chain-momentum-tier={momentum.tier}
                data-chain-momentum-tone={momentum.tone}
                style={
                    {
                        '--chain-momentum-meter-fill': `${momentum.meterFill}%`
                    } as CSSProperties
                }
                role="progressbar"
            >
                {momentum.label ? <b>{momentum.label}</b> : null}
                {momentum.chaseLabel ? <small>{momentum.chaseLabel}</small> : null}
                <i aria-hidden="true" className={styles.chainOpportunityMomentumMeter}>
                    <i aria-hidden="true" className={styles.chainOpportunityMomentumMeterFill} />
                </i>
                <FeedbackBeatPips
                    className={styles.chainOpportunityMomentumBeatPips}
                    count={momentum.beatCount}
                    itemProps={(index) => ({
                        'data-chain-momentum-beat': index + 1,
                        'data-chain-momentum-beat-focus': index === 0 ? 'primary' : 'support'
                    })}
                    keyPrefix={`chain-momentum-${momentum.tier}`}
                />
            </span>
        ) : null}
        <span
            aria-label={`Chain lines meter. ${lines.items.length} ${lines.items.length === 1 ? 'line' : 'lines'}.`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={lines.meterFill}
            className={styles.chainOpportunityLines}
            data-chain-lines-action={lines.action}
            data-chain-lines-meter-fill={lines.meterFill}
            data-chain-lines-tier={lines.tier}
            data-chain-lines-tone={lines.tone}
            style={
                {
                    '--chain-lines-meter-fill': `${lines.meterFill}%`
                } as CSSProperties
            }
            role="progressbar"
        >
            {lines.items.join(' / ')}
            <i aria-hidden="true" className={styles.chainOpportunityLinesMeter}>
                <i aria-hidden="true" className={styles.chainOpportunityLinesMeterFill} />
            </i>
            <FeedbackBeatPips
                className={styles.chainOpportunityLinesBeatPips}
                count={lines.beatCount}
                itemProps={(index) => ({
                    'data-chain-lines-beat': index + 1,
                    'data-chain-lines-beat-focus': index === 0 ? 'primary' : 'support'
                })}
                keyPrefix={`chain-lines-${lines.action}`}
            />
        </span>
    </>
);

export default TileBoardChainOpportunityStatusMeters;
