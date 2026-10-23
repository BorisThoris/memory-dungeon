import { describe, expect, it } from 'vitest';
import { CARVE_SWIPE_MIN_PX, carveSwipeDirection } from './carveSwipe';

describe("Carve's picker takes a swipe (DGE-015)", () => {
    it('points along the longer axis, and a tap is not a swipe', () => {
        expect(carveSwipeDirection(80, 10)).toBe('right');
        expect(carveSwipeDirection(-80, 30)).toBe('left');
        expect(carveSwipeDirection(5, 90)).toBe('down');
        expect(carveSwipeDirection(-20, -70)).toBe('up');
        expect(carveSwipeDirection(CARVE_SWIPE_MIN_PX / 2, 0)).toBeNull();
    });
});
