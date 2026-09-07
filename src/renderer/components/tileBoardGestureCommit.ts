import type { TileBoardGesturePoint } from './tileBoardViewport';

/**
 * How far a two-finger contact has to travel before the board treats it as a camera gesture.
 *
 * A second finger landing on the board is not, by itself, a pinch. Rapid play puts two fingers
 * down in overlapping order all the time — the player taps a pair, and the second tap arrives
 * before the first finger has lifted. Committing to the camera on contact meant those presses
 * were swallowed and the board drifted instead: the exact "my input vanished and the camera
 * moved" the fast half of the game is played in. So contact only arms the gesture, and the
 * gesture commits when the fingers actually do something a pinch or a two-finger pan does.
 */
export const TOUCH_GESTURE_COMMIT_SLOP_PX = 14;

export interface TileBoardGesturePointPair {
    first: TileBoardGesturePoint;
    second: TileBoardGesturePoint;
}

const travel = (from: TileBoardGesturePoint, to: TileBoardGesturePoint): number =>
    Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY);

const span = (pair: TileBoardGesturePointPair): number =>
    Math.hypot(pair.second.clientX - pair.first.clientX, pair.second.clientY - pair.first.clientY);

/**
 * True once the contact has moved enough to be a camera gesture rather than two taps.
 *
 * Either finger travelling past the slop counts (a two-finger pan), and so does the distance
 * between them changing past it (a pinch that barely moves either finger's centre).
 */
export const twoFingerContactIsACameraGesture = (
    start: TileBoardGesturePointPair,
    current: TileBoardGesturePointPair,
    slopPx: number = TOUCH_GESTURE_COMMIT_SLOP_PX
): boolean =>
    travel(start.first, current.first) >= slopPx ||
    travel(start.second, current.second) >= slopPx ||
    Math.abs(span(current) - span(start)) >= slopPx;

/**
 * How long a mouse press may last and how far it may slide and still count as a click.
 *
 * The pan threshold on its own has the same problem the touch path had: a fast click on a mouse
 * that slides a few pixels under the press was read as a drag, and the pick was dropped. A press
 * that is over this quickly was a click whatever the hand did in the meantime, as long as it did
 * not go far enough to have been aimed anywhere else.
 */
export const MOUSE_TAP_MAX_DURATION_MS = 250;
export const MOUSE_TAP_MAX_TRAVEL_PX = 24;

export const mousePressWasATap = ({
    dragActive,
    durationMs,
    travelPx
}: {
    dragActive: boolean;
    durationMs: number;
    travelPx: number;
}): boolean =>
    !dragActive || (durationMs <= MOUSE_TAP_MAX_DURATION_MS && travelPx <= MOUSE_TAP_MAX_TRAVEL_PX);
