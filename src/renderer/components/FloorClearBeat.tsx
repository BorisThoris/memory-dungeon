import { memo } from 'react';
import type { LevelResult } from '../../shared/contracts';
import { FLOOR_CLEAR_COPY } from '../copy/floorClearChain';
import styles from './FloorClearBeat.module.css';

export interface FloorClearBeatProps {
    result: LevelResult;
    personalBest: boolean;
    /** The beat is over and the stamp is on its way out (`FLOOR_CLEAR_BEAT_EXIT_MS`): drawn, not announced. */
    leaving?: boolean;
}

/** How long the stamp takes to leave once the next floor takes over; matches `floorClearBeatOut`. */
export const FLOOR_CLEAR_BEAT_EXIT_MS = 320;

/** A brief, unframed payout over the board while the next floor prepares. */
const FloorClearBeat = ({ leaving = false, personalBest, result }: FloorClearBeatProps) => (
    <div
        aria-hidden={leaving ? true : undefined}
        aria-live={leaving ? undefined : 'polite'}
        className={styles.beat}
        data-leaving={leaving ? 'true' : undefined}
        data-personal-best={personalBest ? 'true' : undefined}
        data-testid={leaving ? 'floor-clear-beat-leaving' : 'floor-clear-beat'}
        data-board-overlay="floor-clear"
        data-tier={result.momentumBonusTier ?? 'none'}
        role={leaving ? undefined : 'status'}
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
