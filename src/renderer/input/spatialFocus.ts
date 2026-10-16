/**
 * Directional focus: given where the focus ring is and every place it could go, pick the one a
 * player pushing the stick that way meant.
 *
 * Tab order is a single line through the document, which is the wrong shape for these screens —
 * pressing right on a three-across card row should reach the neighbouring card, not the next thing
 * the DOM happens to list. This works off geometry instead, so it needs no per-screen wiring: any
 * button that lays out to the right of the current one is reachable by pressing right.
 */

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

export interface FocusRect {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
}

export interface SpatialCandidate<T> {
    readonly rect: FocusRect;
    readonly value: T;
}

/** Overlap on the cross axis is what makes two controls feel like they are "in the same row". */
const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const centre = (start: number, end: number): number => (start + end) / 2;

/**
 * A candidate has to sit meaningfully past the current control's leading edge in the pressed
 * direction. Controls that merely nudge over by a pixel are the same row; a threshold keeps a
 * one-pixel layout difference from turning "right" into a move that looks like nothing happened.
 */
const EDGE_THRESHOLD_PX = 4;

/**
 * Distance along the pressed axis is what we minimise; misalignment across it is a penalty rather
 * than a disqualifier, so a slightly staggered grid still walks in the order it looks like it
 * should. The weight is high enough that a well-aligned far control beats a badly aligned near one.
 */
const CROSS_AXIS_PENALTY = 2.5;

export const pickSpatialNeighbour = <T>(
    from: FocusRect,
    candidates: readonly SpatialCandidate<T>[],
    direction: FocusDirection
): T | null => {
    let best: T | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
        const { rect } = candidate;
        let along: number;
        let across: number;
        /*
         * A control laid over the current one (the HUD over the board's full-stage region) has no
         * edge past the board's in any direction, so edges alone made it unreachable: the only way
         * "up" out of the board was the 1x1 skip link above the window. Inside an enclosing rect,
         * which way it lies is read from the centres instead.
         */
        const enclosed = rect.left >= from.left && rect.right <= from.right && rect.top >= from.top && rect.bottom <= from.bottom;

        if (direction === 'up' || direction === 'down') {
            const forward = enclosed
                ? direction === 'up'
                    ? centre(from.top, from.bottom) - centre(rect.top, rect.bottom)
                    : centre(rect.top, rect.bottom) - centre(from.top, from.bottom)
                : direction === 'up'
                  ? from.top - rect.top
                  : rect.top - from.top;
            if (forward < EDGE_THRESHOLD_PX) {
                continue;
            }
            along = Math.abs(centre(rect.top, rect.bottom) - centre(from.top, from.bottom));
            const shared = overlap(from.left, from.right, rect.left, rect.right);
            across = shared > 0 ? 0 : Math.abs(centre(rect.left, rect.right) - centre(from.left, from.right));
        } else {
            const forward = enclosed
                ? direction === 'left'
                    ? centre(from.left, from.right) - centre(rect.left, rect.right)
                    : centre(rect.left, rect.right) - centre(from.left, from.right)
                : direction === 'left'
                  ? from.left - rect.left
                  : rect.left - from.left;
            if (forward < EDGE_THRESHOLD_PX) {
                continue;
            }
            along = Math.abs(centre(rect.left, rect.right) - centre(from.left, from.right));
            const shared = overlap(from.top, from.bottom, rect.top, rect.bottom);
            across = shared > 0 ? 0 : Math.abs(centre(rect.top, rect.bottom) - centre(from.top, from.bottom));
        }

        const score = along + across * CROSS_AXIS_PENALTY;
        if (score < bestScore) {
            bestScore = score;
            best = candidate.value;
        }
    }

    return best;
};
