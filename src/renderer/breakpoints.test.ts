import { describe, expect, it } from 'vitest';
import {
    isNarrowShortLandscapeForMenuStack,
    isShortLandscapeViewport,
    readWindowInnerSizeFallback,
    safeSubscribeWindowResize,
    VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH,
    VIEWPORT_SHORT_LANDSCAPE_MAX_HEIGHT
} from './breakpoints';
import {
    HIGH_TRAFFIC_VIEWPORT_MATRIX,
    RESPONSIVE_VIEWPORT_MATRIX,
    RESPONSIVE_SCREEN_ROUTES,
    classifyResponsiveViewport,
    getFinalDeviceGridSummary,
    getViewportRegressionExpectations,
    responsiveViewportIdsForScreen,
    responsiveMatrixFinalDeviceGridSummary
} from './viewportMatrix';

describe('isShortLandscapeViewport', () => {
    it('is true for 1280×720 HD landscape', () => {
        expect(isShortLandscapeViewport(1280, 720)).toBe(true);
    });

    it('is false when height exceeds cap', () => {
        expect(isShortLandscapeViewport(1920, 1080)).toBe(false);
    });

    it('is false in portrait', () => {
        expect(isShortLandscapeViewport(720, 1280)).toBe(false);
    });

    it('uses VIEWPORT_SHORT_LANDSCAPE_MAX_HEIGHT as upper bound', () => {
        expect(VIEWPORT_SHORT_LANDSCAPE_MAX_HEIGHT).toBe(860);
        expect(isShortLandscapeViewport(2000, 860)).toBe(true);
        expect(isShortLandscapeViewport(2000, 861)).toBe(false);
    });
});

describe('isNarrowShortLandscapeForMenuStack', () => {
    it('is false for wide short HD (1280×720)', () => {
        expect(isNarrowShortLandscapeForMenuStack(1280, 720)).toBe(false);
    });

    it('is true for narrow short landscape (900×700)', () => {
        expect(isNarrowShortLandscapeForMenuStack(900, 700)).toBe(true);
    });

    it('is true at exactly stack max width when short landscape', () => {
        expect(isNarrowShortLandscapeForMenuStack(VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH, 720)).toBe(true);
    });

    it('is false one px above stack max width', () => {
        expect(isNarrowShortLandscapeForMenuStack(VIEWPORT_LANDSCAPE_STACK_MAX_WIDTH + 1, 720)).toBe(false);
    });
});

describe('readWindowInnerSizeFallback', () => {
    it('returns a usable size in browser-like environments', () => {
        const s = readWindowInnerSizeFallback();
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
    });
});

describe('safeSubscribeWindowResize', () => {
    it('returns an unsubscribe that is safe to call twice', () => {
        const unsub = safeSubscribeWindowResize(() => {});
        expect(typeof unsub).toBe('function');
        unsub();
        unsub();
    });
});

describe('REG-028 high-traffic viewport regression matrix', () => {
    it('covers phone portrait, phone landscape, tablet, short desktop, and desktop baselines', () => {
        expect(HIGH_TRAFFIC_VIEWPORT_MATRIX.map((entry) => entry.id)).toEqual([
            'phone_360x740',
            'phone_390x844',
            'phone_430x932',
            'phone_landscape_844x390',
            'tablet_768x1024',
            'short_desktop_1024x768',
            'short_wide_1366x640',
            'desktop_1440x900'
        ]);
        expect(RESPONSIVE_VIEWPORT_MATRIX.map((entry) => entry.id)).toEqual(
            HIGH_TRAFFIC_VIEWPORT_MATRIX.map((entry) => entry.id)
        );
        expect(HIGH_TRAFFIC_VIEWPORT_MATRIX.every((entry) => entry.mustShowPrimaryAction)).toBe(true);
    });

    it('derives screen-specific layout expectations without screenshots', () => {
        const phoneLandscape = getViewportRegressionExpectations('phone_landscape_844x390');
        expect(phoneLandscape).toMatchObject({
            compactDensity: true,
            menuStacks: true,
            settingsLayout: 'short-stacked'
        });

        const shortWide = getViewportRegressionExpectations('short_wide_1366x640');
        expect(shortWide).toMatchObject({
            compactDensity: true,
            menuStacks: false,
            settingsLayout: 'wide-short'
        });
    });
});

describe('REG-102 final responsive device grid', () => {
    it('covers every high-traffic shell screen with at least one phone and desktop route', () => {
        const summary = responsiveMatrixFinalDeviceGridSummary();
        expect(getFinalDeviceGridSummary()).toEqual(summary);
        expect(summary.viewportCount).toBe(8);
        expect(summary.screenCount).toBeGreaterThanOrEqual(7);
        expect(summary.hasPhoneCoverage).toBe(true);
        expect(summary.hasDesktopCoverage).toBe(true);
        expect(summary.allScreensHavePrimarySelectors).toBe(true);
        expect(RESPONSIVE_SCREEN_ROUTES.every((route) => route.requiredViewportIds.length > 0)).toBe(true);
    });

    it('classifies and resolves viewport route coverage helpers used by visual QA', () => {
        expect(classifyResponsiveViewport(390, 844)).toBe('phone_portrait');
        expect(classifyResponsiveViewport(1366, 640)).toBe('short_desktop');
        expect(responsiveViewportIdsForScreen('gameplay')).toContain('phone_360x740');
    });
});
