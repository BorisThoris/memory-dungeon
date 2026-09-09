import { memo } from 'react';
import type { LevelResult } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import OverlayModal, { type ModalAction } from './OverlayModal';
import styles from './FloorClearDialog.module.css';
import { FLOOR_CLEAR_CHAIN_COPY } from '../copy/floorClearChain';

/**
 * Floor cleared. One dialog that says three things: what the floor paid, how it went, and (on
 * endless floors) the objective outcome. Nothing else lives here; coaching, causality and momentum
 * strips were deleted, the three doors went with the route offer (Gen 173; the wiring in Gen
 * 174), and the risk wager went with the Favor it paid (Gen 175).
 */

export interface FloorClearDialogProps {
    result: LevelResult;
    totalScore: number;
    bestStreak: number;
    /** "Clean floor bonus: +1 Life", when a life was earned. */
    lifeBonusLine: string | null;
    /** One line for the featured objective outcome on endless floors, or null. */
    objectiveLine: string | null;
    /**
     * Who is waiting on the next floor, named before you commit to the stairs. Rolled from the
     * run's own seed, so this is a promise the floor advance keeps rather than flavour text.
     */
    residentLine: string | null;
    actions: ModalAction[];
}

const ratingLabel = (rating: LevelResult['rating']): string => String(rating ?? '-');

const FloorClearDialog = ({
    actions,
    bestStreak,
    lifeBonusLine,
    objectiveLine,
    residentLine,
    result,
    totalScore
}: FloorClearDialogProps) => {
    const level = runNonNegativeInteger(result.level);
    const scoreGained = runNonNegativeInteger(result.scoreGained);
    const mistakes = runNonNegativeInteger(result.mistakes);
    const lives = runNonNegativeInteger(result.livesRemaining);
    const chainLine = FLOOR_CLEAR_CHAIN_COPY.recapLine(result);
    const parLine = FLOOR_CLEAR_CHAIN_COPY.parLine(result);
    const bonusLine = FLOOR_CLEAR_CHAIN_COPY.bonusLine(result);

    return (
        <OverlayModal
            actions={actions}
            headerPlateTone="success"
            ornamentalHeaderPlate
            quietHeaderPlate
            subtitle={`Floor ${level}${parLine ? ` · ${parLine}` : ''}${result.perfect ? ' · Perfect clear' : ''}`}
            title="Floor cleared"
        >
            <div
                className={styles.body}
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

                {lifeBonusLine || objectiveLine || residentLine || chainLine || bonusLine ? (
                    <ul className={styles.notes} data-testid="floor-clear-notes">
                        {bonusLine ? (
                            <li data-testid="floor-clear-bonus" data-tone={result.momentumBonusTier === 'fever' ? 'reward' : undefined}>
                                {bonusLine}
                            </li>
                        ) : null}
                        {lifeBonusLine ? <li data-tone="reward">{lifeBonusLine}</li> : null}
                        {chainLine ? (
                            <li data-testid="floor-clear-chain" data-tone={result.momentumBonusTier === 'fever' ? 'reward' : undefined}>
                                {chainLine}
                            </li>
                        ) : null}
                        {objectiveLine ? <li>{objectiveLine}</li> : null}
                        {residentLine ? (
                            <li data-testid="floor-clear-resident" data-tone="resident">
                                {residentLine}
                            </li>
                        ) : null}
                    </ul>
                ) : null}


            </div>
        </OverlayModal>
    );
};

export default memo(FloorClearDialog);
