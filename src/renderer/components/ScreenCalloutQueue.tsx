import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ScreenCallout } from './screenCallouts';
import styles from './ScreenCalloutQueue.module.css';

/**
 * One live stamp, with no backlog. A new event immediately replaces the previous stamp.
 * Callers order simultaneous receipts by importance; only the first fresh receipt is shown.
 * All its siblings are consumed too, so a rank-up never trails behind stale pickup receipts.
 *
 * Keys are the contract. A callout is played once per key, so a re-render with the same turn
 * behind it shows nothing new, and a run that opens on a turn already made (a resumed save)
 * seeds its keys as seen and stays quiet until the next turn.
 */
export const SCREEN_CALLOUT_MAJOR_MS = 1150;
export const SCREEN_CALLOUT_MINOR_MS = 820;
/** How fast a stamp gets out of the way of the floor-clear beat (`quiet`). */
export const SCREEN_CALLOUT_YIELD_MS = 180;

export interface ScreenCalloutQueueProps {
    callouts: readonly ScreenCallout[];
    reduceMotion: boolean;
    lowQuality?: boolean;
    /**
     * Something bigger owns the screen (the floor-clear beat): the stamp showing fades out fast and
     * nothing new is stamped. The last pair's reaction ("STEAM!") used to sit printed over
     * "FLOOR 1 CLEARED" for most of the beat (recorded 2026-10-16).
     */
    quiet?: boolean;
}

export function ScreenCalloutQueue({ callouts, reduceMotion, lowQuality = false, quiet = false }: ScreenCalloutQueueProps) {
    const seen = useRef<Set<string> | null>(null);
    const [showing, setShowing] = useState<ScreenCallout | null>(null);
    // The first render's callouts are the state the screen opened on, not moments to stamp.
    if (seen.current === null) seen.current = new Set(callouts.map((callout) => callout.key));
    useEffect(() => {
        const fresh = callouts.filter((callout) => !seen.current!.has(callout.key));
        if (fresh.length === 0) return;
        for (const callout of fresh) seen.current!.add(callout.key);
        if (!quiet) setShowing(fresh[0]!);
        // Read when the callouts change, not when quiet does: a beat's end must not replay a stamp.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callouts]);
    useEffect(() => {
        if (!quiet || !showing) return undefined;
        const timer = window.setTimeout(() => setShowing(null), reduceMotion ? 0 : SCREEN_CALLOUT_YIELD_MS);
        return () => window.clearTimeout(timer);
    }, [quiet, showing, reduceMotion]);
    useEffect(() => {
        if (!showing) return undefined;
        const timer = window.setTimeout(
            () => setShowing((current) => current?.key === showing.key ? null : current),
            (showing.size === 'major' ? SCREEN_CALLOUT_MAJOR_MS : SCREEN_CALLOUT_MINOR_MS) + 60
        );
        return () => window.clearTimeout(timer);
    }, [showing]);
    return (
        <div className={styles.layer}>
        {showing ?
        <div
            aria-hidden="true"
            className={styles.callout}
            data-callout-kind={showing.kind}
            data-callout-size={showing.size}
            data-callout-tone={showing.tone}
            data-callout-rare={showing.rare ? 'true' : 'false'}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-low-quality={lowQuality ? 'true' : 'false'}
            data-yielding={quiet ? 'true' : undefined}
            data-testid="screen-callout"
            key={showing.key}
            // How long the title is, so a place name fits on one line where a short shout stays huge.
            style={{ ...(showing.color ? { '--stamp': showing.color } : {}), '--stamp-chars': Math.max(1, showing.title.length) } as CSSProperties}
        >
            <span className={styles.flash} />
            <span className={styles.ring} />
            <span className={styles.lines} />
            <span className={styles.stamp} data-testid="screen-callout-stamp">
                <span className={styles.stampText} data-text={showing.title}>
                    {showing.title}
                </span>
            </span>
        </div>
        : null}
        </div>
    );
}
