import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { ITEM_DROP_COPY } from '../copy/itemDropCopy';
import {
    ITEM_DROP_HOLD_MS,
    ITEM_DROP_RARITY_COLOR,
    ITEM_DROP_RARITY_LABEL,
    type ItemDrop,
    type ItemDropGlyph
} from './itemDrops';
import styles from './ItemDropPopup.module.css';

/** The item's glyph: plain shapes, drawn in the rarity's colour, readable at a glance on a phone. */
const GLYPH_PATHS: Readonly<Record<ItemDropGlyph, ReactElement>> = {
    star: <path d="M32 6l7.6 16.9 18.4 1.8-13.8 12.3 4 18.1L32 45.6 15.8 55.1l4-18.1L6 24.7l18.4-1.8z" />,
    comet: (
        <>
            <circle cx="40" cy="24" r="12" />
            <path d="M31 33L8 56M36 35L18 58M29 28L6 46" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
        </>
    ),
    heart: <path d="M32 56S8 41 8 23a12 12 0 0124-4 12 12 0 0124 4c0 18-24 33-24 33z" />,
    eye: (
        <>
            <path d="M4 32s10-18 28-18 28 18 28 18-10 18-28 18S4 32 4 32z" fill="none" stroke="currentColor" strokeWidth="5" />
            <circle cx="32" cy="32" r="9" />
        </>
    ),
    shuffle: <path d="M8 20h30l-6-6m6 6l-6 6M56 44H26l6-6m-6 6l6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />,
    bomb: (
        <>
            <circle cx="28" cy="38" r="18" />
            <path d="M40 24l8-8M48 16l6-2M48 16l2-6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
        </>
    ),
    gem: <path d="M18 10h28l12 14-26 32L6 24zM6 24h52M24 10l-6 14 14 32 14-32-6-14" fill="currentColor" stroke="rgba(0,0,0,0.35)" strokeLinejoin="round" strokeWidth="2" />,
    flask: <path d="M24 6h16M27 6v16L10 52a5 5 0 004 7h36a5 5 0 004-7L37 22V6" />,
    focus: <path d="M32 4l24 28-24 28L8 32z" />,
    hourglass: <path d="M14 6h36M14 58h36M18 6c0 16 28 16 28 26S18 42 18 58h28c0-16-28-16-28-26S46 22 46 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
};

export interface ItemDropPopupProps {
    drops: readonly ItemDrop[];
    reduceMotion: boolean;
    /** Plays the drop's sting, by rarity, as it shows. */
    onShow?: (drop: ItemDrop) => void;
}

/**
 * The item drop (`itemDrops.ts`): one at a time, in arrival order, each held for its rarity's time
 * or until the player taps, clicks or presses a key. Like the stamps it plays each key once, and the
 * drops present when the screen opens are what it opened on, not news. Reduced motion keeps the
 * card and drops the beam's spin and the gem's pop.
 */
export function ItemDropPopup({ drops, reduceMotion, onShow }: ItemDropPopupProps) {
    const seen = useRef<Set<string> | null>(null);
    const [queue, setQueue] = useState<ItemDrop[]>([]);
    if (seen.current === null) seen.current = new Set(drops.map((drop) => drop.key));
    useEffect(() => {
        const fresh = drops.filter((drop) => !seen.current!.has(drop.key));
        if (fresh.length === 0) return;
        for (const drop of fresh) seen.current!.add(drop.key);
        setQueue((current) => [...current, ...fresh].slice(-6));
    }, [drops]);
    const showing = queue[0] ?? null;
    const dismiss = useCallback(() => setQueue((current) => current.slice(1)), []);
    const shownKey = useRef<string | null>(null);
    useEffect(() => {
        if (!showing || shownKey.current === showing.key) return undefined;
        shownKey.current = showing.key;
        onShow?.(showing);
        return undefined;
    }, [showing, onShow]);
    useEffect(() => {
        if (!showing) return undefined;
        const timer = window.setTimeout(dismiss, ITEM_DROP_HOLD_MS[showing.rarity]);
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') dismiss();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('keydown', onKey);
        };
    }, [showing, dismiss]);
    if (!showing) return null;
    const color = ITEM_DROP_RARITY_COLOR[showing.rarity];
    const rarity = ITEM_DROP_RARITY_LABEL[showing.rarity];
    return (
        <div className={styles.layer} data-reduce-motion={reduceMotion ? 'true' : 'false'}>
            <button
                aria-label={ITEM_DROP_COPY.announce(rarity, showing.name, showing.line)}
                className={styles.drop}
                data-rarity={showing.rarity}
                data-testid="item-drop"
                key={showing.key}
                onClick={dismiss}
                style={{ '--rarity': color } as CSSProperties}
                type="button"
            >
                <span aria-hidden="true" className={styles.beam} />
                <span aria-hidden="true" className={styles.kicker}>
                    {ITEM_DROP_COPY.kicker}
                </span>
                <span aria-hidden="true" className={styles.gem}>
                    <svg className={styles.glyph} fill="currentColor" viewBox="0 0 64 64">
                        {GLYPH_PATHS[showing.glyph]}
                    </svg>
                </span>
                <span aria-hidden="true" className={styles.rarity}>
                    {rarity}
                </span>
                <span aria-hidden="true" className={styles.name}>
                    {showing.name}
                </span>
                <span aria-hidden="true" className={styles.line}>
                    {showing.line}
                </span>
                <span aria-hidden="true" className={styles.skip}>
                    {ITEM_DROP_COPY.skipHint}
                </span>
            </button>
            <span aria-live="polite" className={styles.srOnly} role="status">
                {ITEM_DROP_COPY.announce(rarity, showing.name, showing.line)}
            </span>
        </div>
    );
}
