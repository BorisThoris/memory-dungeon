import { describe, expect, it } from 'vitest';
import { readCssZoom } from './cssZoom';

const element = (visualWidth: number, layoutWidth: number): Parameters<typeof readCssZoom>[0] => ({
    clientWidth: layoutWidth,
    getBoundingClientRect: () => ({ width: visualWidth }) as DOMRect
});

describe('readCssZoom', () => {
    it('is 1 when nothing is zoomed', () => {
        expect(readCssZoom(element(1280, 1280))).toBe(1);
    });

    it('reports the ratio the shell is actually painted at', () => {
        // The measured case: a 1280 window whose shell lays out 1600 wide under `zoom: 0.8`.
        expect(readCssZoom(element(1280, 1600))).toBeCloseTo(0.8, 5);
        expect(readCssZoom(element(1280, 1163.64))).toBeCloseTo(1.1, 4);
    });

    /**
     * A hidden or collapsed element measures 0 by 0. Returning its ratio would be 0 or NaN, and the
     * caller divides by this, so a clearance would come out as Infinity or NaN and be written into
     * a CSS length that means nothing. One is the honest answer: no zoom that can be established.
     */
    it('falls back to 1 rather than a ratio a caller cannot divide by', () => {
        expect(readCssZoom(element(0, 0))).toBe(1);
        expect(readCssZoom(element(1280, 0))).toBe(1);
        expect(readCssZoom(element(0, 1280))).toBe(1);
        expect(readCssZoom(element(Number.NaN, 1280))).toBe(1);
    });
});
