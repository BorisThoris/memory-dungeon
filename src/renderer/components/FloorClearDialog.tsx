import { memo } from 'react';
import type { LevelResult, RouteNodeType } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import OverlayModal, { type ModalAction } from './OverlayModal';
import styles from './FloorClearDialog.module.css';

/**
 * Floor cleared. One dialog that says four things: what the floor paid, how it went, which
 * door comes next, and (on endless floors) whether the player wants to stake the objective
 * streak. Nothing else lives here; coaching, causality and momentum strips were deleted.
 */

export interface FloorClearRouteOption {
    id: string;
    routeType: RouteNodeType;
    /** Door title: "Safe passage", "Greedy route", "Mystery route". */
    label: string;
    /** Room the door leads to: "Rest", "Treasure", "Keeper Chamber via Safe passage". */
    room: string;
    /** Kept in the accessible name when the room converged on a boss gate. */
    approachLabel?: string;
    glyph: string;
    reward: string;
    risk: string;
    available: boolean;
    unavailableLabel?: string;
}

export interface FloorClearSelectedRoute {
    routeType: RouteNodeType;
    label: string;
    line: string;
}

export interface FloorClearWager {
    armed: boolean;
    bonusFavor: number;
    streakAtRisk: number;
    suretyActive: boolean;
}

export interface FloorClearDialogProps {
    result: LevelResult;
    totalScore: number;
    bestStreak: number;
    /** "Clean floor bonus: +1 Life", when a life was earned. */
    lifeBonusLine: string | null;
    /** One line for the featured objective outcome on endless floors, or null. */
    objectiveLine: string | null;
    routeRequired: boolean;
    routeIntro: string;
    routeOptions: readonly FloorClearRouteOption[];
    selectedRoute: FloorClearSelectedRoute | null;
    wager: FloorClearWager | null;
    onChooseRoute: (id: string) => void;
    onArmWager: () => void;
    actions: ModalAction[];
}

const ratingLabel = (rating: LevelResult['rating']): string => String(rating ?? '-');

const sentence = (value: string): string => value.trim().replace(/[.!]+$/u, '');

const FloorClearDialog = ({
    actions,
    bestStreak,
    lifeBonusLine,
    objectiveLine,
    onArmWager,
    onChooseRoute,
    result,
    routeIntro,
    routeOptions,
    routeRequired,
    selectedRoute,
    totalScore,
    wager
}: FloorClearDialogProps) => {
    const level = runNonNegativeInteger(result.level);
    const scoreGained = runNonNegativeInteger(result.scoreGained);
    const mistakes = runNonNegativeInteger(result.mistakes);
    const lives = runNonNegativeInteger(result.livesRemaining);
    const streakLine = wager
        ? wager.armed
            ? `Risk wager armed. The next objective pays +${wager.bonusFavor} Favor; a miss ${
                  wager.suretyActive ? 'drops' : 'breaks'
              } the x${wager.streakAtRisk} streak.`
            : `Stake your x${wager.streakAtRisk} objective streak on the next floor for +${wager.bonusFavor} Favor.`
        : null;

    return (
        <OverlayModal
            actions={actions}
            headerPlateTone="success"
            ornamentalHeaderPlate
            quietHeaderPlate
            subtitle={`Floor ${level}${result.perfect ? ' · Perfect clear' : ''}`}
            title="Floor cleared"
        >
            <div
                className={styles.body}
                data-route-choice-required={routeRequired ? 'true' : 'false'}
                data-testid="floor-clear-result-stack"
            >
                <div className={styles.score}>
                    <span className={styles.scoreLabel}>Floor score</span>
                    <strong className={styles.scoreValue} data-testid="floor-clear-score">
                        +{scoreGained.toLocaleString()}
                    </strong>
                    <span className={styles.scoreTotal}>Run total {runNonNegativeInteger(totalScore).toLocaleString()}</span>
                </div>

                <dl aria-label="Floor stats" className={styles.stats} data-testid="floor-clear-stats">
                    <div className={styles.stat}>
                        <dt>Rating</dt>
                        <dd>{ratingLabel(result.rating)}</dd>
                    </div>
                    <div className={styles.stat}>
                        <dt>Best streak</dt>
                        <dd>{runNonNegativeInteger(bestStreak)}</dd>
                    </div>
                    <div className={styles.stat}>
                        <dt>Misses</dt>
                        <dd>{mistakes}</dd>
                    </div>
                    <div className={styles.stat}>
                        <dt>Lives</dt>
                        <dd>{lives}</dd>
                    </div>
                </dl>

                {lifeBonusLine || objectiveLine ? (
                    <ul className={styles.notes} data-testid="floor-clear-notes">
                        {lifeBonusLine ? <li data-tone="reward">{lifeBonusLine}</li> : null}
                        {objectiveLine ? <li>{objectiveLine}</li> : null}
                    </ul>
                ) : null}

                {routeRequired ? (
                    <section
                        aria-labelledby="floor-clear-route-title"
                        className={styles.routes}
                        data-decision-state="required"
                        data-testid="route-choice-panel"
                    >
                        <h3 className={styles.routesTitle} id="floor-clear-route-title">
                            Choose the next door
                        </h3>
                        <p className={styles.routesIntro} data-testid="route-choice-required-copy">
                            {routeIntro}
                        </p>
                        <div className={styles.doors}>
                            {routeOptions.map((option) => {
                                const consequence = option.available ? option.risk : option.unavailableLabel ?? option.risk;
                                const name = `${[
                                    option.label,
                                    option.approachLabel ? `Approach: ${option.approachLabel}` : null,
                                    option.room,
                                    `Reward: ${option.reward}`,
                                    option.available ? `Risk: ${option.risk}` : option.unavailableLabel ?? 'Unavailable'
                                ]
                                    .filter((part): part is string => Boolean(part))
                                    .map(sentence)
                                    .join('. ')}.`;
                                return (
                                    <button
                                        aria-label={name}
                                        className={styles.door}
                                        data-route-type={option.routeType}
                                        data-testid={`route-choice-${option.routeType}`}
                                        disabled={!option.available}
                                        key={option.id}
                                        onClick={() => {
                                            if (!option.available) {
                                                return;
                                            }
                                            onChooseRoute(option.id);
                                        }}
                                        type="button"
                                    >
                                        <span aria-hidden="true" className={styles.doorGlyph}>
                                            {option.glyph}
                                        </span>
                                        <strong className={styles.doorTitle}>{option.label}</strong>
                                        <span className={styles.doorRoom}>
                                            {option.approachLabel ? `Approach: ${option.approachLabel}. ` : ''}
                                            {option.room}
                                        </span>
                                        <span className={styles.doorReward}>{option.reward}</span>
                                        <span
                                            className={styles.doorRisk}
                                            data-tone={option.available ? 'risk' : 'locked'}
                                        >
                                            {consequence}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ) : selectedRoute ? (
                    <p className={styles.selected} data-route-type={selectedRoute.routeType} data-testid="route-selected-note">
                        <strong>{selectedRoute.label} selected.</strong> {selectedRoute.line}
                    </p>
                ) : null}

                {wager && streakLine ? (
                    <div className={styles.wager} data-armed={wager.armed ? 'true' : 'false'} data-testid="endless-risk-wager-panel">
                        <span className={styles.wagerLine}>{streakLine}</span>
                        {wager.armed ? null : (
                            <button
                                aria-label={`Arm wager. Stake: x${wager.streakAtRisk} streak. Payoff: +${wager.bonusFavor} Favor. Trigger: Next objective; miss it and the streak ${
                                    wager.suretyActive ? 'falls to x1' : 'breaks'
                                }.`}
                                className={styles.wagerButton}
                                onClick={onArmWager}
                                type="button"
                            >
                                Arm wager
                            </button>
                        )}
                    </div>
                ) : null}
            </div>
        </OverlayModal>
    );
};

export default memo(FloorClearDialog);
