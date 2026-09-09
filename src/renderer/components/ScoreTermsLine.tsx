import { useEffect, useState, type ReactElement } from 'react';
import type { BreakScoreBreakdown } from '../../shared/score-terms-rules';
import { scoreTermLabel } from '../copy/matchScoreFloater';
import styles from './GameScreen.module.css';

/**
 * How long one term holds before the next arrives. Short enough that the whole line is in before a
 * floater of any size fades, long enough that each term is a separate beat rather than a flicker.
 */
export const SCORE_TERM_STEP_MS = 170;

/**
 * The break's score, built in front of the player (thesis §40.4).
 *
 * The terms are already what the rule multiplies; until now they were multiplied out of sight and
 * the player met only the product. Each term arrives on its own beat and the total climbs with it,
 * ending on the score the run actually gave - which is the Balatro moment, and it was free.
 */
const ScoreTermsLine = ({
    breakdown,
    reduceMotion
}: {
    breakdown: BreakScoreBreakdown;
    reduceMotion: boolean;
}): ReactElement => {
    const termCount = breakdown.terms.length;
    // Reduced motion gets the finished line: the construction is the flourish, the number is the point.
    const [revealed, setRevealed] = useState(() => (reduceMotion ? termCount : 1));

    /*
     * Only the timers live here. The floater is keyed by the turn, so every break mounts a fresh
     * line and the initial state above is already right - resetting it in the effect would set
     * state synchronously during a render pass for no gain. A motion-setting change mid-floater
     * keeps whatever the line was showing, which lasts under a second.
     */
    useEffect(() => {
        if (reduceMotion || termCount <= 1) {
            return undefined;
        }
        const timers = Array.from({ length: termCount - 1 }, (_, index) =>
            window.setTimeout(() => setRevealed(index + 2), SCORE_TERM_STEP_MS * (index + 1))
        );
        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [reduceMotion, termCount]);

    const shown = breakdown.terms.slice(0, revealed);
    const runningTotal = shown[shown.length - 1]?.runningTotal ?? 0;

    return (
        <span
            className={styles.boardFloaterTerms}
            data-score-terms-count={termCount}
            data-score-terms-revealed={revealed}
            data-testid="board-floater-score-terms"
        >
            {shown.map((term) => scoreTermLabel(term)).join(' × ')}
            {` = ${runningTotal.toLocaleString()}`}
        </span>
    );
};

export default ScoreTermsLine;
