import { useEffect, useState, type ReactNode } from 'react';

/**
 * Keeps an overlay on screen for its exit.
 *
 * A dialog rendered as `{open && <OverlayModal />}` is gone the frame `open` turns false, so it can
 * only ever cut out: recorded in real time, Resume snapped the pause sheet away in one frame
 * (2026-10-16). Written as `<Presence show={open}><OverlayModal /></Presence>`, the children are
 * shown while `show` is true and kept for `exitMs` after it turns false - drawn, but inert and
 * aria-hidden, under `data-presence-leaving` - so a stylesheet can fade them out
 * (`OverlayModal.module.css`).
 * The wrapper is `display: contents`: fixed and absolute children lay out as they did without it.
 */
export function Presence({ show, exitMs, reduceMotion = false, children }: { show: boolean; exitMs: number; reduceMotion?: boolean; children: ReactNode }) {
    const [wasShown, setWasShown] = useState(show);
    const [leaving, setLeaving] = useState(false);
    // Decided in the render that hides it (adjusting state while rendering), so no frame goes by
    // with the overlay gone before its exit starts.
    if (show !== wasShown) {
        setWasShown(show);
        setLeaving(!show && !reduceMotion);
    }
    useEffect(() => {
        if (!leaving) return undefined;
        const timer = window.setTimeout(() => setLeaving(false), exitMs);
        return () => window.clearTimeout(timer);
    }, [leaving, exitMs]);
    if (show) {
        return <div style={{ display: 'contents' }}>{children}</div>;
    }
    if (!leaving) return null;
    return (
        <div aria-hidden="true" data-presence-leaving="true" inert style={{ display: 'contents' }}>
            {children}
        </div>
    );
}
