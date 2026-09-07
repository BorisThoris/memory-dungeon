import { describe, expect, it } from 'vitest';
import {
    MOUSE_TAP_MAX_DURATION_MS,
    MOUSE_TAP_MAX_TRAVEL_PX,
    mousePressWasATap,
    TOUCH_GESTURE_COMMIT_SLOP_PX,
    twoFingerContactIsACameraGesture
} from './tileBoardGestureCommit';

const pair = (ax: number, ay: number, bx: number, by: number) => ({
    first: { clientX: ax, clientY: ay },
    second: { clientX: bx, clientY: by }
});

describe('two-finger contact', () => {
    it('is not a camera gesture while the fingers are still', () => {
        const start = pair(100, 100, 160, 100);

        expect(twoFingerContactIsACameraGesture(start, start)).toBe(false);
    });

    it('is not a camera gesture for the jitter of a second tap landing', () => {
        const start = pair(100, 100, 160, 100);
        const jittered = pair(102, 101, 163, 98);

        expect(twoFingerContactIsACameraGesture(start, jittered)).toBe(false);
    });

    it('becomes a camera gesture once a finger pans past the slop', () => {
        const start = pair(100, 100, 160, 100);
        const panned = pair(100 + TOUCH_GESTURE_COMMIT_SLOP_PX, 100, 160 + TOUCH_GESTURE_COMMIT_SLOP_PX, 100);

        expect(twoFingerContactIsACameraGesture(start, panned)).toBe(true);
    });

    it('becomes a camera gesture on a pinch that only changes the span', () => {
        // Each finger moves half the slop, so neither trips the travel test on its own; the
        // distance between them changes by the whole slop, which is what a pinch is.
        const start = pair(100, 100, 160, 100);
        const half = TOUCH_GESTURE_COMMIT_SLOP_PX / 2;
        const pinched = pair(100 - half, 100, 160 + half, 100);

        expect(twoFingerContactIsACameraGesture(start, pinched)).toBe(true);
    });
});

describe('a mouse press', () => {
    it('is a tap when the drag threshold was never crossed', () => {
        expect(mousePressWasATap({ dragActive: false, durationMs: 4_000, travelPx: 0 })).toBe(true);
    });

    it('is still a tap when a fast click slid a little under the finger', () => {
        expect(
            mousePressWasATap({
                dragActive: true,
                durationMs: MOUSE_TAP_MAX_DURATION_MS,
                travelPx: MOUSE_TAP_MAX_TRAVEL_PX
            })
        ).toBe(true);
    });

    it('is a drag when the press was held', () => {
        expect(
            mousePressWasATap({ dragActive: true, durationMs: MOUSE_TAP_MAX_DURATION_MS + 1, travelPx: 2 })
        ).toBe(false);
    });

    it('is a drag when the pointer travelled far enough to be aimed somewhere else', () => {
        expect(mousePressWasATap({ dragActive: true, durationMs: 40, travelPx: MOUSE_TAP_MAX_TRAVEL_PX + 1 })).toBe(
            false
        );
    });
});
