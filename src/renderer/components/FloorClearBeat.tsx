import { memo } from 'react';
import type { LevelResult } from '../../shared/contracts';
import { FLOOR_CLEAR_COPY } from '../copy/floorClearChain';
import styles from './FloorClearBeat.module.css';

export interface FloorClearBeatProps {
    result: LevelResult;
    personalBest: boolean;
}

/** A brief, unframed payout over the board while the next floor prepares. */
const FloorClearBeat = ({ personalBest, result }: FloorClearBeatProps) => (
    <div
        aria-live="polite"
        className={styles.beat}
        data-personal-best={personalBest ? 'true' : undefined}
        data-testid="floor-clear-beat"
        data-board-overlay="floor-clear"
        data-tier={result.momentumBonusTier ?? 'none'}
        role="status"
    >
        <div className={styles.stamp}>
            <p className={styles.title} data-testid="floor-clear-title">
                {FLOOR_CLEAR_COPY.titleLine(result.level)}
            </p>
            <p className={styles.score} data-testid="floor-clear-score">
                {FLOOR_CLEAR_COPY.scoreLine(result.scoreGained)}
            </p>
            {personalBest ? (
                <p className={styles.personalBest} data-testid="floor-clear-personal-best">
                    {FLOOR_CLEAR_COPY.personalBest}
                </p>
            ) : null}
        </div>
    </div>
);

export default memo(FloorClearBeat);
