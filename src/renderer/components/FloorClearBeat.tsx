import { memo } from 'react';
import type { LevelResult } from '../../shared/contracts';
import { FLOOR_CLEAR_COPY } from '../copy/floorClearChain';
import styles from './FloorClearBeat.module.css';

/**
 * The floor-clear beat. A floor ends on the board, not on a screen (thesis §41.4): the last pair
 * leaves, this settles over the stage for a breath and a half, and the next board builds on the
 * same surface while it is still being read. It states four things - the floor, its turns against
 * par, what it paid and why - and offers nothing to press, because a stop is where players leave.
 *
 * It replaced the floor-clear dialog (Gen 182), which had a Continue button and a Main Menu button
 * and was a screen between every two floors.
 */
export interface FloorClearBeatProps {
    result: LevelResult;
    totalScore: number;
    /** The cleared floor is deeper than any this profile has cleared before. */
    personalBest: boolean;
    /** Small notes under the bonus: the objective's outcome, who is downstairs. */
    notes: readonly string[];
}

const FloorClearBeat = ({ notes, personalBest, result, totalScore }: FloorClearBeatProps) => {
    const parLine = FLOOR_CLEAR_COPY.parLine(result);
    const bonusLine = FLOOR_CLEAR_COPY.bonusLine(result);
    const tier = result.momentumBonusTier ?? 'none';
    return (
        <div
            aria-live="polite"
            className={styles.beat}
            data-personal-best={personalBest ? 'true' : undefined}
            data-testid="floor-clear-beat"
            data-tier={tier}
            role="status"
        >
            <p className={styles.title} data-testid="floor-clear-title">
                {FLOOR_CLEAR_COPY.titleLine(result.level)}
                {parLine ? (
                    <span className={styles.par} data-testid="floor-clear-par">
                        {parLine}
                    </span>
                ) : null}
            </p>
            {personalBest ? (
                <p className={styles.personalBest} data-testid="floor-clear-personal-best">
                    {FLOOR_CLEAR_COPY.personalBest}
                </p>
            ) : null}
            <p className={styles.score}>
                <strong className={styles.scoreValue} data-testid="floor-clear-score">
                    {FLOOR_CLEAR_COPY.scoreLine(result.scoreGained)}
                </strong>
                <span className={styles.scoreTotal}>{FLOOR_CLEAR_COPY.runTotalLine(totalScore)}</span>
            </p>
            {bonusLine ? (
                <p className={styles.bonus} data-testid="floor-clear-bonus">
                    {bonusLine}
                </p>
            ) : null}
            {notes.length > 0 ? (
                <ul className={styles.notes} data-testid="floor-clear-notes">
                    {notes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
};

export default memo(FloorClearBeat);
