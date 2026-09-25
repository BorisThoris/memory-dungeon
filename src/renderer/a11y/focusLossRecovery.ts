import { useEffect, useRef, type RefObject } from 'react';
import { useLatestRef } from '../hooks/useLatestRef';

/**
 * Where focus goes when the control that held it stops being a control.
 *
 * A store buy button that has just bought the last relic goes `disabled`; the dock's Bomb that has
 * just spent its last charge is taken out of the dock. Either way the browser drops focus on
 * `<body>`, and a keyboard player's next Tab starts again from the skip link at the top of the
 * page - measured in a real run, both happened on the first press. The control's neighbours are
 * still there, so focus belongs on one of them.
 */

const isDisabled = (el: HTMLElement): boolean => (el as HTMLButtonElement).disabled === true;

/**
 * True when `lost` held focus and can no longer: it left the document or went disabled, and focus
 * is either on nothing or still (for a moment) on the dead control itself.
 */
export const focusWasLostWith = (lost: HTMLElement | null, doc: Document = document): boolean => {
    if (!lost) {
        return false;
    }
    const active = doc.activeElement;
    const focusDropped = active === null || active === doc.body || active === lost;
    return focusDropped && (!lost.isConnected || isDisabled(lost));
};

/**
 * The control that takes over from the one at `lostIndex`: the first enabled one at or after that
 * position (a removed control's place is taken by its next sibling, a disabled one is skipped),
 * else the nearest enabled one before it.
 */
export const pickFocusSuccessor = (controls: readonly HTMLElement[], lostIndex: number): HTMLElement | null => {
    const start = Math.max(0, Math.min(lostIndex, controls.length));
    const after = controls.slice(start).find((control) => !isDisabled(control));
    return after ?? [...controls.slice(0, start)].reverse().find((control) => !isDisabled(control)) ?? null;
};

interface FocusLossRecoveryOptions {
    /** The controls inside the container that can hold focus. */
    selector: string;
    /** Somewhere outside the container, when nothing inside it can take focus any more. */
    fallback?: () => HTMLElement | null;
    /** Told where focus went, so a roving toolbar can move its tab stop there too. */
    onRecovered?: (next: HTMLElement) => void;
}

/**
 * Watches a group of controls and, after any render in which the focused one died, puts focus on
 * its successor. It only acts when focus was lost WITH that control, so a player who clicked or
 * tabbed somewhere else is never pulled back.
 */
export const useFocusLossRecovery = (
    containerRef: RefObject<HTMLElement | null>,
    { selector, fallback, onRecovered }: FocusLossRecoveryOptions
): void => {
    const lastRef = useRef<{ el: HTMLElement; index: number } | null>(null);
    const fallbackRef = useLatestRef(fallback);
    const onRecoveredRef = useLatestRef(onRecovered);

    useEffect(() => {
        const root = containerRef.current;
        if (!root) {
            return;
        }
        const onFocusIn = (event: FocusEvent): void => {
            const target = event.target;
            if (target instanceof HTMLElement && target.matches(selector)) {
                lastRef.current = { el: target, index: Array.from(root.querySelectorAll(selector)).indexOf(target) };
            }
        };
        root.addEventListener('focusin', onFocusIn);
        return () => root.removeEventListener('focusin', onFocusIn);
    }, [containerRef, selector]);

    // Every render: the control dies in a commit, and this is the first moment after it.
    useEffect(() => {
        const root = containerRef.current;
        const last = lastRef.current;
        if (!root || !last || !focusWasLostWith(last.el)) {
            return;
        }
        lastRef.current = null;
        const controls = Array.from(root.querySelectorAll<HTMLElement>(selector));
        const next = pickFocusSuccessor(controls, last.index) ?? fallbackRef.current?.() ?? null;
        if (next) {
            next.focus({ preventScroll: true });
            onRecoveredRef.current?.(next);
        }
    });
};
