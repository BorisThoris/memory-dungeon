import { memo, useEffect, useState } from 'react';
import type { LevelResult } from '../../shared/contracts';
import { FLOOR_CLEAR_COPY } from '../copy/floorClearChain';
import styles from './FloorClearBeat.module.css';

export interface FloorClearBeatProps {
    result: LevelResult;
    personalBest: boolean;
    /** The beat is over and the stamp is on its way out (`FLOOR_CLEAR_BEAT_EXIT_MS`): drawn, not announced. */
    leaving?: boolean;
    /** Count the payout up as the stamp lands (off under reduced motion, and for the leaving copy). */
    countUp?: boolean;
    /** The next floor's realm, when it is another one: named as its room crossfades in behind the beat. */
    nextPlace?: string | null;
    /** The next milestone and the floors to it (`milestone-rules.ts`), so the reward is never the end of the view. */
    milestone?: { readonly name: string; readonly floorsToGo: number } | null;
}

/** The payout counts up over this, after the stamp has landed (`floorClearBeatIn`, 320ms). */
export const FLOOR_CLEAR_COUNT_UP_MS = 650;
const FLOOR_CLEAR_COUNT_UP_DELAY_MS = 140;

/**
 * The payout counting up from nothing, the way a score is paid out rather than printed. Shown to the
 * eye only: the live region carries the final figure, so a screen reader hears it once, not per frame.
 */
const useCountUp = (target: number, enabled: boolean): number => {
    const [shown, setShown] = useState(enabled ? 0 : target);
    useEffect(() => {
        if (!enabled) return undefined;
        let frame = 0;
        const started = performance.now() + FLOOR_CLEAR_COUNT_UP_DELAY_MS;
        const tick = (now: number) => {
            const u = Math.min(1, Math.max(0, (now - started) / FLOOR_CLEAR_COUNT_UP_MS));
            const eased = 1 - (1 - u) ** 3;
            setShown(Math.round(target * eased));
            if (u < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [enabled, target]);
    return enabled ? shown : target;
};

/** How long the stamp takes to leave once the next floor takes over; matches `floorClearBeatOut`. */
export const FLOOR_CLEAR_BEAT_EXIT_MS = 320;

/** A brief, unframed payout over the board while the next floor prepares. */
const FloorClearBeat = ({ countUp = false, leaving = false, milestone = null, nextPlace = null, personalBest, result }: FloorClearBeatProps) => {
    const shownScore = useCountUp(result.scoreGained, countUp && !leaving);
    return (
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
                <span className={styles.srOnly}>{FLOOR_CLEAR_COPY.scoreLine(result.scoreGained)}</span>
                <span aria-hidden="true">{FLOOR_CLEAR_COPY.scoreLine(shownScore)}</span>
            </p>
            {personalBest ? (
                <p className={styles.personalBest} data-testid="floor-clear-personal-best">
                    {FLOOR_CLEAR_COPY.personalBest}
                </p>
            ) : null}
            {nextPlace ? (
                <p className={styles.onward} data-testid="floor-clear-onward">
                    {FLOOR_CLEAR_COPY.onwardLine(nextPlace)}
                </p>
            ) : null}
            {milestone ? (
                <p className={styles.milestone} data-testid="floor-clear-milestone">
                    {FLOOR_CLEAR_COPY.milestoneLine(milestone.name, milestone.floorsToGo)}
                </p>
            ) : null}
        </div>
    </div>
    );
};

export default memo(FloorClearBeat);
