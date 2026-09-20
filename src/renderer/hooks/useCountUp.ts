import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up to its new value instead of jumping there.
 *
 * The thesis timing table (§45.2) has the score total "count up, 350ms, ease-out, never jumps":
 * the rise is the part of a break the player watches land, and a total that snaps from 70 to 575
 * gives that moment nothing to look at. Ease-out, so the first digits move fast and the last few
 * settle, which reads as the number arriving rather than scrolling.
 *
 * Driven by a timer rather than an animation frame, for the same reason the HUD announcer is: a
 * window that is not painting still has to end on the right number, and a frame that never comes
 * would leave the old total on screen for as long as the window stayed covered.
 */
export const COUNT_UP_MS = 350;
const TICK_MS = 16;

/** Ease-out cubic between two integers; whole numbers only, and the end value exactly at the end. */
export const countUpValue = (from: number, to: number, elapsedMs: number, durationMs = COUNT_UP_MS): number => {
    if (durationMs <= 0 || elapsedMs >= durationMs) {
        return to;
    }
    if (elapsedMs <= 0) {
        return from;
    }
    const t = elapsedMs / durationMs;
    const eased = 1 - (1 - t) ** 3;
    const value = from + (to - from) * eased;
    return to >= from ? Math.floor(value) : Math.ceil(value);
};

export const useCountUp = (
    target: number,
    { reduceMotion = false, durationMs = COUNT_UP_MS }: { reduceMotion?: boolean; durationMs?: number } = {}
): number => {
    // Mounts on the target: a fresh HUD shows the score it has, it does not count up from zero.
    const [shown, setShown] = useState(target);
    const shownRef = useRef(target);

    useEffect(() => {
        if (reduceMotion || durationMs <= 0) {
            // Reduced motion keeps every number exact on the frame it changes; the ref follows so
            // a later animated change starts from the value on screen.
            shownRef.current = target;
            return undefined;
        }
        if (shownRef.current === target) {
            return undefined;
        }
        const from = shownRef.current;
        const startedAt = performance.now();
        const timer = window.setInterval(() => {
            const next = countUpValue(from, target, performance.now() - startedAt, durationMs);
            shownRef.current = next;
            setShown(next);
            if (next === target) {
                window.clearInterval(timer);
            }
        }, TICK_MS);
        return () => {
            window.clearInterval(timer);
        };
    }, [durationMs, reduceMotion, target]);

    return reduceMotion || durationMs <= 0 ? target : shown;
};
