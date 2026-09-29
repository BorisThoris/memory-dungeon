import { useEffect, useRef, useState } from 'react';
import type { ScreenCallout } from './screenCallouts';
import styles from './ScreenCalloutQueue.module.css';

/**
 * The stamps, played one at a time.
 *
 * The arcade tables this is modelled on stamp the screen with a word the moment something
 * happens - a rank reached, a streak lost, a prize taken - big, italic, swept with a sheen of
 * light, slammed in and gone. One at a time, because two stamps at once are none: the queue
 * takes every callout it is handed, plays the ones it has not played, and lets a major hold the
 * centre longer than a minor.
 *
 * Keys are the contract. A callout is played once per key, so a re-render with the same turn
 * behind it shows nothing new, and a run that opens on a turn already made (a resumed save)
 * seeds its keys as seen and stays quiet until the next turn.
 */
export const SCREEN_CALLOUT_MAJOR_MS = 1150;
export const SCREEN_CALLOUT_MINOR_MS = 820;

export interface ScreenCalloutQueueProps {
    callouts: readonly ScreenCallout[];
    reduceMotion: boolean;
}

export function ScreenCalloutQueue({ callouts, reduceMotion }: ScreenCalloutQueueProps) {
    const seen = useRef<Set<string> | null>(null);
    const pending = useRef<ScreenCallout[]>([]);
    const [showing, setShowing] = useState<ScreenCallout | null>(null);
    // The first render's callouts are the state the screen opened on, not moments to stamp.
    if (seen.current === null) seen.current = new Set(callouts.map((callout) => callout.key));
    useEffect(() => {
        const fresh = callouts.filter((callout) => !seen.current!.has(callout.key));
        if (fresh.length === 0) return;
        for (const callout of fresh) seen.current!.add(callout.key);
        pending.current.push(...fresh);
        setShowing((current) => current ?? pending.current.shift() ?? null);
    }, [callouts]);
    useEffect(() => {
        if (!showing) return undefined;
        const timer = window.setTimeout(
            () => setShowing(pending.current.shift() ?? null),
            (showing.size === 'major' ? SCREEN_CALLOUT_MAJOR_MS : SCREEN_CALLOUT_MINOR_MS) + 60
        );
        return () => window.clearTimeout(timer);
    }, [showing]);
    if (!showing) return null;
    return (
        <div
            aria-hidden="true"
            className={styles.callout}
            data-callout-kind={showing.kind}
            data-callout-size={showing.size}
            data-callout-tone={showing.tone}
            data-reduce-motion={reduceMotion ? 'true' : 'false'}
            data-testid="screen-callout"
            key={showing.key}
        >
            <span className={styles.flash} />
            <span className={styles.ring} />
            <span className={styles.lines} />
            <span className={styles.stamp} data-testid="screen-callout-stamp">
                <span className={styles.stampText} data-text={showing.title}>
                    {showing.title}
                </span>
            </span>
            <span className={styles.sub} data-testid="screen-callout-sub">
                {showing.sub}
            </span>
        </div>
    );
}
