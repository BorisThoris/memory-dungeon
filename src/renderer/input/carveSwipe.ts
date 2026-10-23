import type { CarveDirection } from '../../shared/contracts';

/** How far a press must travel to be a swipe rather than a tap, in CSS pixels (DGE-015). */
export const CARVE_SWIPE_MIN_PX = 40;

/**
 * The way a swipe across Carve's picker points: the longer axis of the travel, or null for a press that
 * barely moved (a tap on one of the picker's own buttons). Screen y grows downward.
 */
export const carveSwipeDirection = (dx: number, dy: number, min = CARVE_SWIPE_MIN_PX): CarveDirection | null => {
    if (Math.hypot(dx, dy) < min) return null;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
};
