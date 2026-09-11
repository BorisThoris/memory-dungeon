import { describe, expect, it } from 'vitest';

import { SETTINGS_NUMERIC_RANGES } from '../shared/save-data';
import { VIEWPORT_MOBILE_MAX, VIEWPORT_TABLET_MAX } from './breakpoints';
import {
    isCompactUiViewport,
    isShortLandscapeDesktop,
    safeUiScaleFor,
    UI_SCALE_COMPACT,
    UI_SCALE_MAX
} from './uiScaleLimits';

/**
 * The cap used to be three literals inside `App.tsx` behind a variable called `safeUiScale`, and
 * the word "safe" was the only thing asserting anything. What holds it now is `uiScaleLimits.ts`'s
 * own comment, `e2e/ui-scale-ceiling.spec.ts`'s measurement, and this.
 */
describe('the UI scale limits', () => {
    it('stops the slider where the app stops applying it', () => {
        /*
         * The slider ran to 1.4 while the app never applied more than 1.15, so the top fifth of its
         * travel moved and changed nothing on screen - a control that describes something it does
         * not do. `save-data.ts` is shared and must not import the renderer, so the two numbers are
         * written in two places and this is what keeps them the same number.
         */
        expect(SETTINGS_NUMERIC_RANGES.uiScale.max).toBe(UI_SCALE_MAX);
        expect(SETTINGS_NUMERIC_RANGES.uiScale.min).toBeLessThan(UI_SCALE_MAX);
    });

    it('caps a desktop window at the largest scale every screen was measured to hold', () => {
        /*
         * 1.05, because at 1.1 the main menu loses its meta frame on a 1440x900 desktop - measured,
         * not assumed (`e2e/ui-scale-ceiling.spec.ts`). It is a small number and the reason is a
         * missing container-query rung in the main menu, not a judgement about how much scaling a
         * player needs; Xbox's guidelines ask for 200% and this is nowhere near it.
         */
        expect(UI_SCALE_MAX).toBe(1.05);
        expect(safeUiScaleFor(2, { height: 900, width: 1440 })).toBe(UI_SCALE_MAX);
        expect(safeUiScaleFor(1.15, { height: 800, width: 1280 })).toBe(UI_SCALE_MAX);
        // Under the cap the player gets what they asked for, including scales below 1.
        expect(safeUiScaleFor(1.02, { height: 900, width: 1440 })).toBe(1.02);
        expect(safeUiScaleFor(0.8, { height: 900, width: 1440 })).toBe(0.8);
        // A missing or broken stored value is a scale of 1, never NaN on every box in the app.
        expect(safeUiScaleFor(Number.NaN, { height: 900, width: 1440 })).toBe(UI_SCALE_COMPACT);
    });

    it('lays a phone out at 1 and a wide short landscape out as a desktop', () => {
        expect(isCompactUiViewport({ height: 844, width: 390 })).toBe(true);
        expect(safeUiScaleFor(1.05, { height: 844, width: 390 })).toBe(UI_SCALE_COMPACT);
        // 1280x720: wider than a tablet, shorter than the mobile bound, and landscape - a desktop.
        expect(isShortLandscapeDesktop({ height: 720, width: 1280 })).toBe(true);
        expect(isCompactUiViewport({ height: 720, width: 1280 })).toBe(false);
        expect(safeUiScaleFor(1.05, { height: 720, width: 1280 })).toBe(1.05);
        // A short window that is NOT wide is compact, which is the case that separates the two.
        expect(isShortLandscapeDesktop({ height: 700, width: VIEWPORT_TABLET_MAX })).toBe(false);
        expect(isCompactUiViewport({ height: VIEWPORT_MOBILE_MAX, width: VIEWPORT_TABLET_MAX })).toBe(true);
    });
});
