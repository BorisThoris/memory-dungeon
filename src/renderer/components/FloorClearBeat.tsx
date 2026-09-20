import { memo } from 'react';
import type { LevelResult } from '../../shared/contracts';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { FLOOR_CLEAR_COPY } from '../copy/floorClearChain';
import styles from './FloorClearBeat.module.css';

/**
 * The floor-clear beat. A floor ends on the board, not on a screen (thesis §41.4): the last pair
 * leaves, this settles over the stage for a breath and a half, and the next board builds on the
 * same surface while it is still being read. It states four things - the floor, its turns against
 * par, what it paid and why - and offers nothing to press, because a stop is where players leave.
 *
 * Set as a colophon: a ruled block in the middle of the page, the floor's numeral as a watermark
 * behind it, the payout in display type. It replaced the floor-clear dialog (Gen 182), which had
 * a Continue button and a Main Menu button and was a screen between every two floors.
 */
export interface FloorClearBeatProps {
    result: LevelResult;
    totalScore: number;
    /** The cleared floor is deeper than any this profile has cleared before. */
    personalBest: boolean;
    /** Small notes under the bonus: the objective's outcome, who is downstairs. */
    notes: readonly string[];
}

const ROMAN: ReadonlyArray<readonly [number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
];

/** The floor's numeral for the watermark; decorative only, the title carries the number. */
const romanNumeral = (value: number): string => {
    let remaining = runNonNegativeInteger(value);
    if (remaining === 0) {
        return '0';
    }
    let out = '';
    for (const [weight, glyph] of ROMAN) {
        while (remaining >= weight) {
            out += glyph;
            remaining -= weight;
        }
    }
    return out;
};

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
            <div className={styles.colophon}>
                <span aria-hidden="true" className={styles.watermark}>
                    {romanNumeral(result.level)}
                </span>
                <p className={styles.title} data-testid="floor-clear-title">
                    {FLOOR_CLEAR_COPY.titleLine(result.level)}
                </p>
                {parLine ? (
                    <p className={styles.par} data-testid="floor-clear-par">
                        {parLine}
                    </p>
                ) : null}
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
                    <>
                        <span aria-hidden="true" className={styles.rule} />
                        <ul className={styles.notes} data-testid="floor-clear-notes">
                            {notes.map((note) => (
                                <li key={note}>{note}</li>
                            ))}
                        </ul>
                    </>
                ) : null}
            </div>
        </div>
    );
};

export default memo(FloorClearBeat);
