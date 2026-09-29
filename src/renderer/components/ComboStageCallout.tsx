import { useEffect, useState } from 'react';
import { COMBO_STAGE_CALLOUTS, type ComboHeatStage } from '../../shared/combo-heat-rules';
import styles from './ComboStageCallout.module.css';

/**
 * The rank-up stamp.
 *
 * The arcade pool tables this feedback system is modelled on stamp the screen the moment a streak
 * crosses a rank - "ON FIRE!", "UNSTOPPABLE!" - big, centred, slammed in and gone in a second,
 * with a sting under it and the table shaking. It is the one moment the whole screen belongs to
 * the combo rather than to the board, and it is what makes a rank feel *reached* rather than
 * noticed in a corner. The HUD's stage label is the record; this is the event.
 *
 * Keyed by the turn that reached the stage (`calloutKey`), so a run that opens already at
 * Blazing - a resumed save, a replayed floor - shows nothing until it climbs, and two rank-ups
 * in one turn (a pop can jump a stage) show the stage arrived at, once. Reduced motion keeps
 * the stamp and its colour and loses the slam, the flash and the shards.
 */
export interface ComboStageCalloutProps {
    stage: Exclude<ComboHeatStage, 'cold' | 'warm'> | null;
    /** Identity of the turn that reached the stage; a new key restarts the stamp. Null shows nothing. */
    calloutKey: string | null;
    /** The combo standing when the stage was reached, printed under the stamp. */
    combo: number;
    reduceMotion: boolean;
}

/** How long the stamp holds the screen; the CSS animation runs this long and ends hidden. */
export const COMBO_STAGE_CALLOUT_MS = 1150;

export function ComboStageCallout({ stage, calloutKey, combo, reduceMotion }: ComboStageCalloutProps) {
    const [doneKey, setDoneKey] = useState<string | null>(null);
    // A key that never animates (reduced motion, a hidden tab) still has to leave: time it out.
    useEffect(() => {
        if (calloutKey === null) return undefined;
        const timer = window.setTimeout(() => setDoneKey(calloutKey), COMBO_STAGE_CALLOUT_MS + 80);
        return () => window.clearTimeout(timer);
    }, [calloutKey]);
    if (stage === null || calloutKey === null || doneKey === calloutKey) return null;
    return (
        <div
            aria-hidden="true"
            className={styles.callout}
            data-combo-stage={stage}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-testid="combo-stage-callout"
            key={calloutKey}
            onAnimationEnd={(event) => {
                if (event.target === event.currentTarget) setDoneKey(calloutKey);
            }}
        >
            <span className={styles.flash} />
            <span className={styles.shards} />
            <span className={styles.stamp} data-testid="combo-stage-callout-stamp">
                {COMBO_STAGE_CALLOUTS[stage]}
            </span>
            <span className={styles.sub}>{`Combo ×${Math.max(0, Math.floor(combo))}`}</span>
        </div>
    );
}
