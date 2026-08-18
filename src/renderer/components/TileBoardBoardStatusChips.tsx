import type { CSSProperties, ReactNode } from 'react';
import FeedbackBeatPips from './FeedbackBeatPips';
import styles from './TileBoard.module.css';

interface TraitModeCueView {
    accessibleLabel?: string;
    action: string;
    beatCount: number;
    detail: string;
    label: string;
    nextReward: string | null;
    screenCue: string;
    tier: string;
    tone: string;
    value: string;
}

interface ActivePowerBoardChipView {
    accessibleLabel?: string;
    action: string;
    beats: number;
    detail: string;
    first: string;
    label: string;
    meterFill: number;
    screenCue: string;
    then: string;
    tier: string;
    tone: string;
}

interface PickupOpportunitySequenceView {
    first: string;
    keep: string;
    then: string;
    tone: string;
}

interface PickupOpportunityChipView {
    accessibleLabel: string;
    action: string;
    beatCount: number;
    examples: string[];
    focus: string;
    meterFill: number;
    screenCue: string;
    sequenceCue: PickupOpportunitySequenceView | null;
    stackCue: string | null;
    stackDetail: string | null;
    target: string | null;
    tier: string;
    valueLabel: string;
}

interface TileBoardBoardStatusChipsProps {
    activePower: ActivePowerBoardChipView | null;
    compact?: boolean;
    pickupOpportunity: PickupOpportunityChipView | null;
    traitMode: TraitModeCueView | null;
}

interface BoardStatusDockProps {
    children: ReactNode;
    className: string;
    testId: string;
}

const meterFillStyle = (variableName: string, value: number) =>
    ({
        [variableName]: `${value}%`
    }) as CSSProperties;

const BoardStatusDock = ({ children, className, testId }: BoardStatusDockProps) =>
    children ? (
        <div className={className} data-testid={testId}>
            {children}
        </div>
    ) : null;

const TileBoardBoardStatusChips = ({
    activePower,
    compact = false,
    pickupOpportunity,
    traitMode
}: TileBoardBoardStatusChipsProps) => {
    const compactTraitModeHint = traitMode ? traitMode.nextReward ?? traitMode.detail : null;
    const compactPickupHint = pickupOpportunity
        ? pickupOpportunity.target ??
          pickupOpportunity.sequenceCue?.first ??
          pickupOpportunity.stackCue ??
          pickupOpportunity.stackDetail
        : null;

    return (
        <>
            <BoardStatusDock className={styles.boardStatusTopLeftDock} testId="board-status-top-left">
                {traitMode ? (
                    <div
                        aria-label={traitMode.accessibleLabel}
                        aria-live="polite"
                        className={styles.traitModeCue}
                        data-trait-mode-action={traitMode.action}
                        data-trait-mode-beats={traitMode.beatCount}
                        data-trait-mode-screen-cue={traitMode.screenCue}
                        data-trait-mode-tier={traitMode.tier}
                        data-testid="trait-mode-cue"
                        data-trait-mode-tone={traitMode.tone}
                        role="group"
                    >
                        <span>{traitMode.label}</span>
                        <strong>{traitMode.value}</strong>
                        {compact ? (
                            compactTraitModeHint ? <small>{compactTraitModeHint}</small> : null
                        ) : (
                            <>
                                {traitMode.nextReward ? <small>{traitMode.nextReward}</small> : null}
                                <FeedbackBeatPips
                                    className={styles.traitModeCueBeatPips}
                                    count={traitMode.beatCount}
                                    itemProps={(index) => ({
                                        'data-trait-mode-beat': index + 1,
                                        'data-trait-mode-beat-action': traitMode.action,
                                        'data-trait-mode-beat-focus': index === 0 ? 'primary' : 'support',
                                        'data-trait-mode-beat-screen-cue': traitMode.screenCue,
                                        'data-trait-mode-beat-tier': traitMode.tier,
                                        'data-trait-mode-beat-tone': traitMode.tone
                                    })}
                                    keyPrefix={`trait-mode-${traitMode.action}`}
                                />
                                <small>{traitMode.detail}</small>
                            </>
                        )}
                    </div>
                ) : null}
            </BoardStatusDock>
            <BoardStatusDock className={styles.boardStatusTopRightDock} testId="board-status-top-right">
                {activePower ? (
                    <div
                        aria-label={activePower.accessibleLabel}
                        className={styles.activePowerBoardChip}
                        data-active-power-action={activePower.action}
                        data-active-power-beats={activePower.beats}
                        data-active-power-first={activePower.first}
                        data-active-power-screen-cue={activePower.screenCue}
                        data-active-power-then={activePower.then}
                        data-active-power-meter-fill={activePower.meterFill}
                        data-active-power-tier={activePower.tier}
                        data-active-power-tone={activePower.tone}
                        data-testid="active-power-board-chip"
                        role="status"
                    >
                        <span>{activePower.label}</span>
                        <strong>{activePower.detail}</strong>
                        <span
                            aria-hidden="true"
                            className={styles.activePowerBoardChipMeter}
                            data-active-power-meter-fill={activePower.meterFill}
                        >
                            <i
                                className={styles.activePowerBoardChipMeterFill}
                                style={meterFillStyle('--active-power-meter-fill', activePower.meterFill)}
                            />
                        </span>
                        {compact ? null : (
                            <>
                                <FeedbackBeatPips
                                    className={styles.activePowerBoardChipBeatPips}
                                    count={activePower.beats}
                                    itemProps={(index) => ({
                                        'data-active-power-beat': index + 1,
                                        'data-active-power-beat-action': activePower.action,
                                        'data-active-power-beat-focus': index === 0 ? 'primary' : 'support',
                                        'data-active-power-beat-screen-cue': activePower.screenCue,
                                        'data-active-power-beat-tier': activePower.tier,
                                        'data-active-power-beat-tone': activePower.tone
                                    })}
                                    keyPrefix={`active-power-${activePower.action}`}
                                />
                                <small data-active-power-step="first" data-active-power-step-tone={activePower.tone}>
                                    First: {activePower.first}
                                    <FeedbackBeatPips
                                        className={styles.activePowerBoardStepBeatPips}
                                        count={2}
                                        itemProps={(index) => ({
                                            'data-active-power-step-beat': index + 1,
                                            'data-active-power-step-beat-action': activePower.action,
                                            'data-active-power-step-beat-focus': index === 0 ? 'primary' : 'support',
                                            'data-active-power-step-beat-phase': 'first',
                                            'data-active-power-step-beat-screen-cue': activePower.screenCue,
                                            'data-active-power-step-beat-tier': activePower.tier,
                                            'data-active-power-step-beat-tone': activePower.tone
                                        })}
                                        keyPrefix={`active-power-step-first-${activePower.action}`}
                                    />
                                </small>
                                <small data-active-power-step="then" data-active-power-step-tone={activePower.tone}>
                                    Then: {activePower.then}
                                    <FeedbackBeatPips
                                        className={styles.activePowerBoardStepBeatPips}
                                        count={2}
                                        itemProps={(index) => ({
                                            'data-active-power-step-beat': index + 1,
                                            'data-active-power-step-beat-action': activePower.action,
                                            'data-active-power-step-beat-focus': index === 0 ? 'primary' : 'support',
                                            'data-active-power-step-beat-phase': 'then',
                                            'data-active-power-step-beat-screen-cue': activePower.screenCue,
                                            'data-active-power-step-beat-tier': activePower.tier,
                                            'data-active-power-step-beat-tone': activePower.tone
                                        })}
                                        keyPrefix={`active-power-step-then-${activePower.action}`}
                                    />
                                </small>
                            </>
                        )}
                    </div>
                ) : null}
            </BoardStatusDock>
            <BoardStatusDock className={styles.boardStatusBottomRightDock} testId="board-status-bottom-right">
                {pickupOpportunity ? (
                    <div
                        aria-label={pickupOpportunity.accessibleLabel}
                        className={styles.pickupOpportunityChip}
                        data-pickup-opportunity-action={pickupOpportunity.action}
                        data-pickup-opportunity-beats={pickupOpportunity.beatCount}
                        data-pickup-opportunity-focus={pickupOpportunity.focus}
                        data-pickup-opportunity-screen-cue={pickupOpportunity.screenCue}
                        data-pickup-opportunity-tier={pickupOpportunity.tier}
                        data-pickup-meter-fill={pickupOpportunity.meterFill}
                        data-testid="pickup-opportunity-chip"
                        role="status"
                    >
                        <span>Pickup rewards</span>
                        <strong>{pickupOpportunity.valueLabel}</strong>
                        {compact ? compactPickupHint ? <b>{compactPickupHint}</b> : null : pickupOpportunity.target ? <b>{pickupOpportunity.target}</b> : null}
                        <span
                            aria-hidden="true"
                            className={styles.pickupOpportunityMeter}
                            data-pickup-meter-fill={pickupOpportunity.meterFill}
                        >
                            <i
                                className={styles.pickupOpportunityMeterFill}
                                style={meterFillStyle('--pickup-meter-fill', pickupOpportunity.meterFill)}
                            />
                        </span>
                        {compact ? null : (
                            <>
                                <FeedbackBeatPips
                                    className={styles.pickupOpportunityChipBeatPips}
                                    count={pickupOpportunity.beatCount}
                                    itemProps={(index) => ({
                                        'data-pickup-chip-beat': index + 1,
                                        'data-pickup-chip-beat-action': pickupOpportunity.action,
                                        'data-pickup-chip-beat-focus': index === 0 ? 'primary' : 'support',
                                        'data-pickup-chip-beat-screen-cue': pickupOpportunity.screenCue,
                                        'data-pickup-chip-beat-tier': pickupOpportunity.tier
                                    })}
                                    keyPrefix={`pickup-opportunity-${pickupOpportunity.action}`}
                                />
                                {pickupOpportunity.stackCue ? <em>{pickupOpportunity.stackCue}</em> : null}
                                {pickupOpportunity.stackDetail ? <i>{pickupOpportunity.stackDetail}</i> : null}
                                {pickupOpportunity.sequenceCue ? (
                                    <span
                                        aria-label={`Pickup sequence. First: ${pickupOpportunity.sequenceCue.first}. Then: ${pickupOpportunity.sequenceCue.then}. Keep: ${pickupOpportunity.sequenceCue.keep}.`}
                                        className={styles.pickupOpportunitySequence}
                                        data-pickup-sequence-tone={pickupOpportunity.sequenceCue.tone}
                                        data-testid="pickup-opportunity-sequence"
                                    >
                                        <small
                                            data-pickup-sequence-phase="first"
                                            data-pickup-sequence-phase-tone={pickupOpportunity.sequenceCue.tone}
                                        >
                                            First
                                        </small>
                                        <b
                                            data-pickup-sequence-value-phase="first"
                                            data-pickup-sequence-value-tone={pickupOpportunity.sequenceCue.tone}
                                        >
                                            {pickupOpportunity.sequenceCue.first}
                                        </b>
                                        <small
                                            data-pickup-sequence-phase="then"
                                            data-pickup-sequence-phase-tone={pickupOpportunity.sequenceCue.tone}
                                        >
                                            Then
                                        </small>
                                        <b
                                            data-pickup-sequence-value-phase="then"
                                            data-pickup-sequence-value-tone={pickupOpportunity.sequenceCue.tone}
                                        >
                                            {pickupOpportunity.sequenceCue.then}
                                        </b>
                                        <small
                                            data-pickup-sequence-phase="keep"
                                            data-pickup-sequence-phase-tone={pickupOpportunity.sequenceCue.tone}
                                        >
                                            Keep
                                        </small>
                                        <b
                                            data-pickup-sequence-value-phase="keep"
                                            data-pickup-sequence-value-tone={pickupOpportunity.sequenceCue.tone}
                                        >
                                            {pickupOpportunity.sequenceCue.keep}
                                        </b>
                                        <FeedbackBeatPips
                                            className={styles.pickupOpportunitySequenceBeatPips}
                                            count={3}
                                            itemProps={(index) => ({
                                                'data-pickup-sequence-beat': index + 1,
                                                'data-pickup-sequence-beat-focus': index === 0 ? 'primary' : 'support',
                                                'data-pickup-sequence-beat-phase': index === 0 ? 'first' : index === 1 ? 'then' : 'keep'
                                            })}
                                            keyPrefix={`pickup-sequence-${pickupOpportunity.action}`}
                                        />
                                    </span>
                                ) : null}
                                {pickupOpportunity.examples.length > 0 ? <small>{pickupOpportunity.examples.join(' / ')}</small> : null}
                            </>
                        )}
                    </div>
                ) : null}
            </BoardStatusDock>
        </>
    );
};

export default TileBoardBoardStatusChips;
