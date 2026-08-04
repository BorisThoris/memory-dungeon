import { FLOOR_CLEAR_LIFE_CARRYOVER_NOTE } from './gameScreenDecisionSignals';
import { GameScreenNextFloorPreview } from './GameScreenNextFloorPreview';
import styles from './GameScreen.module.css';
import type { GameScreenFloorClearProjection } from './useGameScreenFloorClearProjection';

export const GameScreenFloorClearResult = ({
    projection
}: {
    projection: GameScreenFloorClearProjection;
}) => {
    if (!projection.floorClearVisible) return null;

    const {
        bonusTagsLine,
        clearLifeBonusLabel,
        endlessRiskWagerOutcomeLine,
        favorBankedLine,
        favorGainLine,
        featuredObjectiveFailureLine,
        featuredObjectiveResultLine,
        featuredObjectiveStreakLine,
        firstClearOnboardingLine,
        floorClearActionSequenceAriaLabel,
        floorClearActionSequenceCue,
        floorClearCarryForwardAriaLabel,
        floorClearCarryForwardCue,
        floorClearCashoutRows,
        floorClearCashoutRowsLabel,
        floorClearCausalityRows,
        floorClearCausalityRowsLabel,
        floorClearMomentumRows,
        floorClearMomentumRowsLabel,
        floorClearObjectiveSignalProjections,
        floorClearObjectiveSignalRowsLabel,
        floorClearPayoffStackProjection,
        nextFloorProjection,
        objectiveBonusLine,
        routeChoiceRequired,
        traitRouteObjectiveLine
    } = projection;

    return (
        <div
            className={styles.floorClearResultStack}
            data-route-choice-required={routeChoiceRequired ? 'true' : 'false'}
            data-testid="floor-clear-result-stack"
        >
            {floorClearMomentumRows.length > 0 ? (
                <div
                    aria-label={floorClearMomentumRowsLabel}
                    className={styles.floorClearMomentumStrip}
                    data-testid="floor-clear-momentum-strip"
                >
                    {floorClearMomentumRows.map((row) => (
                        <span className={styles.floorClearMomentumChip} data-momentum-kind={row.id} key={row.id}>
                            <small>{row.label}</small>
                            <strong>{row.value}</strong>
                        </span>
                    ))}
                </div>
            ) : null}
            {floorClearPayoffStackProjection ? (
                <div
                    aria-label={floorClearPayoffStackProjection.ariaLabel}
                    className={styles.floorClearPayoffStackSignal}
                    data-floor-payoff-stack-action={floorClearPayoffStackProjection.action}
                    data-floor-payoff-stack-audio={floorClearPayoffStackProjection.audioCue}
                    data-floor-payoff-stack-beats={floorClearPayoffStackProjection.beatCount}
                    data-floor-payoff-stack-screen-cue={floorClearPayoffStackProjection.screenCue}
                    data-floor-payoff-stack-tone={floorClearPayoffStackProjection.tone}
                    data-testid="floor-clear-payoff-stack"
                >
                    <small>{floorClearPayoffStackProjection.label}</small>
                    <strong>{floorClearPayoffStackProjection.value}</strong>
                    <span aria-hidden="true" className={styles.floorClearPayoffStackBeatPips}>
                        {Array.from({ length: floorClearPayoffStackProjection.beatCount }, (_, index) => (
                            <i
                                data-floor-payoff-stack-beat={index + 1}
                                data-floor-payoff-stack-beat-focus={index === 0 ? 'primary' : 'support'}
                                key={index}
                            />
                        ))}
                    </span>
                    <b>{floorClearPayoffStackProjection.action}</b>
                    <em>{floorClearPayoffStackProjection.detail}</em>
                </div>
            ) : null}
            {floorClearCashoutRows.length > 0 ? (
                <div
                    aria-label={floorClearCashoutRowsLabel}
                    className={styles.floorClearCashoutStrip}
                    data-testid="floor-clear-cashout-strip"
                >
                    {floorClearCashoutRows.map((row) => (
                        <span data-cashout-tone={row.tone} key={row.id}>
                            <small>{row.label}</small>
                            <strong>{row.value}</strong>
                            <em>{row.detail}</em>
                        </span>
                    ))}
                </div>
            ) : null}
            {floorClearCarryForwardCue ? (
                <div
                    aria-label={floorClearCarryForwardAriaLabel ?? undefined}
                    className={styles.floorClearCarryForwardCue}
                    data-carry-forward-tone={floorClearCarryForwardCue.tone}
                    data-testid="floor-clear-carry-forward"
                >
                    <small>{floorClearCarryForwardCue.label}</small>
                    <strong>{floorClearCarryForwardCue.value}</strong>
                    <em>{floorClearCarryForwardCue.detail}</em>
                </div>
            ) : null}
            {floorClearActionSequenceCue ? (
                <div
                    aria-label={floorClearActionSequenceAriaLabel ?? undefined}
                    className={styles.floorClearActionSequenceCue}
                    data-floor-clear-sequence-first={floorClearActionSequenceCue.first}
                    data-floor-clear-sequence-keep={floorClearActionSequenceCue.keep}
                    data-floor-clear-sequence-then={floorClearActionSequenceCue.then}
                    data-floor-clear-sequence-tone={floorClearActionSequenceCue.tone}
                    data-testid="floor-clear-action-sequence"
                >
                    <small>{floorClearActionSequenceCue.label}</small>
                    <span>
                        <b>First</b>
                        <strong>{floorClearActionSequenceCue.first}</strong>
                    </span>
                    <span>
                        <b>Then</b>
                        <strong>{floorClearActionSequenceCue.then}</strong>
                    </span>
                    <span>
                        <b>Keep</b>
                        <strong>{floorClearActionSequenceCue.keep}</strong>
                    </span>
                </div>
            ) : null}
            {floorClearObjectiveSignalProjections.length > 0 ? (
                <div
                    aria-label={floorClearObjectiveSignalRowsLabel}
                    className={styles.floorClearObjectiveStrip}
                    data-testid="floor-clear-objective-strip"
                >
                    {floorClearObjectiveSignalProjections.map((signal) => (
                        <span
                            data-objective-audio={signal.audioCue}
                            data-objective-beats={signal.beatCount}
                            data-objective-screen-cue={signal.screenCue}
                            data-objective-tone={signal.tone}
                            key={signal.id}
                        >
                            <small>{signal.label}</small>
                            <strong>{signal.value}</strong>
                            <span aria-hidden="true" className={styles.floorClearObjectiveBeatPips}>
                                {Array.from({ length: signal.beatCount }, (_, index) => (
                                    <i
                                        data-objective-beat={index + 1}
                                        data-objective-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={index}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </div>
            ) : null}
            {floorClearCausalityRows.length > 0 ? (
                <div
                    aria-label={floorClearCausalityRowsLabel}
                    className={styles.floorClearCausalityGrid}
                    data-testid="floor-clear-causality-grid"
                >
                    {floorClearCausalityRows.map((row) => (
                        <p
                            className={styles.modalNote}
                            data-causality-group={row.group}
                            data-mechanic-tokens={row.tokens.join(' ')}
                            key={row.id}
                        >
                            <strong>{row.label}:</strong> {row.detail}
                        </p>
                    ))}
                </div>
            ) : null}
            {clearLifeBonusLabel ? <p className={styles.modalNote}>{clearLifeBonusLabel}</p> : null}
            <p className={styles.modalNote}>{FLOOR_CLEAR_LIFE_CARRYOVER_NOTE}</p>
            {featuredObjectiveResultLine ? <p className={styles.modalNote}>{featuredObjectiveResultLine}</p> : null}
            {featuredObjectiveFailureLine ? <p className={styles.modalNote}>{featuredObjectiveFailureLine}</p> : null}
            {featuredObjectiveStreakLine ? <p className={styles.modalNote}>{featuredObjectiveStreakLine}</p> : null}
            {endlessRiskWagerOutcomeLine ? <p className={styles.modalNote}>{endlessRiskWagerOutcomeLine}</p> : null}
            {favorGainLine ? <p className={styles.modalNote}>{favorGainLine}</p> : null}
            {favorBankedLine ? <p className={styles.modalNote}>{favorBankedLine}</p> : null}
            {firstClearOnboardingLine ? <p className={styles.modalNote}>{firstClearOnboardingLine}</p> : null}
            {objectiveBonusLine ? <p className={styles.modalNote}>{objectiveBonusLine}</p> : null}
            {traitRouteObjectiveLine ? <p className={styles.modalNote}>{traitRouteObjectiveLine}</p> : null}
            {bonusTagsLine ? <p className={styles.modalNote}>{bonusTagsLine}</p> : null}
            <GameScreenNextFloorPreview projection={nextFloorProjection} />
        </div>
    );
};
