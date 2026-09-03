import { describe, expect, it } from 'vitest';
import {
    captureWindowState,
    mergeWindowState,
    MIN_WINDOW_HEIGHT,
    MIN_WINDOW_WIDTH,
    normalizeWindowState,
    resolveRestoredBounds,
    type DisplayArea,
    type WindowBounds
} from './window-bounds';

const laptop: DisplayArea = { height: 900, width: 1440, x: 0, y: 0 };
const secondScreen: DisplayArea = { height: 1080, width: 1920, x: 1440, y: 0 };
const steamDeck: DisplayArea = { height: 800, width: 1280, x: 0, y: 0 };

const bounds = (x: number, y: number, width = 1200, height = 800): WindowBounds => ({
    height,
    width,
    x,
    y
});

describe('normalizeWindowState', () => {
    it('accepts a well-formed stored state', () => {
        expect(normalizeWindowState({ bounds: bounds(40, 60), maximized: true })).toEqual({
            bounds: bounds(40, 60),
            maximized: true
        });
    });

    it('rounds fractional bounds, which fractional display scaling produces', () => {
        const state = normalizeWindowState({ bounds: { height: 800.6, width: 1200.4, x: 40.5, y: 60.2 }, maximized: false });
        expect(state.bounds).toEqual({ height: 801, width: 1200, x: 41, y: 60 });
    });

    it('keeps the maximized flag even when the bounds are unusable', () => {
        expect(normalizeWindowState({ bounds: 'gone', maximized: true })).toEqual({ bounds: null, maximized: true });
    });

    it('throws nothing away quietly but drops what it cannot use', () => {
        for (const value of [null, undefined, 42, 'window', {}, { bounds: {} }]) {
            expect(normalizeWindowState(value).bounds).toBeNull();
        }
        expect(normalizeWindowState({ bounds: { height: 800, width: 1200, x: Number.NaN, y: 0 } }).bounds).toBeNull();
        expect(normalizeWindowState({ bounds: { height: 800, width: 1200, x: Number.POSITIVE_INFINITY, y: 0 } }).bounds).toBeNull();
    });

    it('refuses a stored size below the floor rather than opening an unusable window', () => {
        expect(normalizeWindowState({ bounds: bounds(0, 0, MIN_WINDOW_WIDTH - 1, 800) }).bounds).toBeNull();
        expect(normalizeWindowState({ bounds: bounds(0, 0, 1200, MIN_WINDOW_HEIGHT - 1) }).bounds).toBeNull();
    });
});

describe('resolveRestoredBounds', () => {
    it('restores a window that is still on a display', () => {
        expect(resolveRestoredBounds(bounds(120, 80), [laptop])).toEqual(bounds(120, 80));
    });

    it('restores a window on a second monitor', () => {
        expect(resolveRestoredBounds(bounds(1600, 100), [laptop, secondScreen])).toEqual(bounds(1600, 100));
    });

    it('gives up on a window left on a monitor that is gone', () => {
        expect(resolveRestoredBounds(bounds(1600, 100), [laptop])).toBeNull();
    });

    it('gives up when the title bar would be off the bottom, where it cannot be dragged back', () => {
        expect(resolveRestoredBounds(bounds(100, 880), [laptop])).toBeNull();
    });

    it('gives up when there are no displays to check against', () => {
        expect(resolveRestoredBounds(bounds(0, 0), [])).toBeNull();
        expect(resolveRestoredBounds(null, [laptop])).toBeNull();
    });

    it('clamps a window that no longer fits the display it was saved on', () => {
        // Saved on the 1440x900 laptop, reopened on a Steam Deck.
        const restored = resolveRestoredBounds(bounds(0, 0, 1400, 880), [steamDeck]);
        expect(restored).toEqual({ height: 800, width: 1280, x: 0, y: 0 });
    });

    it('pulls a partly off-screen window fully back on', () => {
        const restored = resolveRestoredBounds(bounds(1300, 700, 1000, 700), [laptop]);
        expect(restored).toEqual({ height: 700, width: 1000, x: 440, y: 200 });
    });

    it('never returns a size under the floor, even on a tiny display', () => {
        const restored = resolveRestoredBounds(bounds(0, 0, 1000, 700), [{ height: 400, width: 600, x: 0, y: 0 }]);
        expect(restored).toEqual({ height: MIN_WINDOW_HEIGHT, width: MIN_WINDOW_WIDTH, x: 0, y: 0 });
    });
});

describe('captureWindowState', () => {
    const win = (overrides: Partial<Parameters<typeof captureWindowState>[0]> = {}) => ({
        getBounds: () => bounds(10, 20),
        getNormalBounds: () => bounds(100, 200, 1000, 700),
        isFullScreen: () => false,
        isMaximized: () => false,
        isMinimized: () => false,
        ...overrides
    });

    it('reads the window as it sits', () => {
        expect(captureWindowState(win())).toEqual({ bounds: bounds(10, 20), maximized: false });
    });

    it('stores the restorable size of a maximized window, not the screen it fills', () => {
        expect(captureWindowState(win({ isMaximized: () => true }))).toEqual({
            bounds: bounds(100, 200, 1000, 700),
            maximized: true
        });
    });

    it('reads nothing off a minimized or fullscreen window', () => {
        expect(captureWindowState(win({ isMinimized: () => true })).bounds).toBeNull();
        expect(captureWindowState(win({ isFullScreen: () => true })).bounds).toBeNull();
    });
});

describe('mergeWindowState', () => {
    it('keeps the last known size when the window had nothing to report', () => {
        const stored = { bounds: bounds(10, 20), maximized: false };
        expect(mergeWindowState(stored, { bounds: null, maximized: true })).toEqual({
            bounds: bounds(10, 20),
            maximized: true
        });
    });

    it('takes a fresh capture over the stored one', () => {
        const stored = { bounds: bounds(10, 20), maximized: true };
        expect(mergeWindowState(stored, { bounds: bounds(30, 40), maximized: false })).toEqual({
            bounds: bounds(30, 40),
            maximized: false
        });
    });
});
