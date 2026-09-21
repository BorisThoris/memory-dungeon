import { describe, expect, it } from 'vitest';
import {
    resolveStartupIntroAppContract,
    resolveStartupIntroOverlayContract,
    STARTUP_INTRO_ASSET_FAILSAFE_MS
} from './startupIntroContract';

describe('startup intro contract', () => {
    it('blocks menu pointer and hides menu semantics while hydration/intro overlay is pending', () => {
        expect(
            resolveStartupIntroAppContract({
                hydrated: false,
                introPlayback: 'pending',
                view: 'boot'
            })
        ).toMatchObject({
            hydrationState: 'hydrating',
            menuAriaHidden: true,
            menuPointerState: 'blocked',
            overlayVisible: true,
            renderMenuShell: true,
            returnFocusTestId: 'main-menu-focus-root'
        });
    });

    it('returns control to the menu when the intro is done after hydration', () => {
        expect(
            resolveStartupIntroAppContract({
                hydrated: true,
                introPlayback: 'done',
                view: 'menu'
            })
        ).toMatchObject({
            hydrationState: 'menu-ready',
            menuAriaHidden: false,
            menuPointerState: 'interactive',
            overlayVisible: false,
            renderMenuShell: true
        });
    });

    it('describes loading, skip-pending, ready, and fallback asset states', () => {
        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: false,
                renderMode: 'three',
                skipPending: false
            })
        ).toEqual({
            assetState: 'loading',
            loadingLabel: 'Preparing intro assets…',
            progress: 0,
            progressPercent: 0,
            skipState: 'idle'
        });

        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: false,
                renderMode: 'three',
                skipPending: true
            })
        ).toEqual({
            assetState: 'loading',
            loadingLabel: 'Skip requested — preparing a safe intro fallback…',
            progress: 0,
            progressPercent: 0,
            skipState: 'requested'
        });

        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: true,
                renderMode: 'fallback',
                skipPending: true
            })
        ).toEqual({
            assetState: 'fallback',
            loadingLabel: null,
            progress: 1,
            progressPercent: 100,
            skipState: 'requested'
        });
    });

    it('reports step progress and prefers the current step label while loading', () => {
        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: false,
                loadedSteps: 1,
                renderMode: 'three',
                skipPending: false,
                stepLabel: 'Cutting the tiles…',
                totalSteps: 3
            })
        ).toMatchObject({
            loadingLabel: 'Cutting the tiles…',
            progressPercent: 33
        });
    });

    it('lets skip copy outrank step copy so the player sees their input was taken', () => {
        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: false,
                loadedSteps: 2,
                renderMode: 'three',
                skipPending: true,
                stepLabel: 'Waking the relic…',
                totalSteps: 3
            })
        ).toMatchObject({
            loadingLabel: 'Skip requested — preparing a safe intro fallback…',
            progressPercent: 67
        });
    });

    it('reads a ready overlay as complete even when no step progress was reported', () => {
        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: true,
                loadedSteps: 0,
                renderMode: 'three',
                skipPending: false,
                totalSteps: 3
            })
        ).toMatchObject({ progress: 1, progressPercent: 100 });
    });

    it('clamps a step count that overshoots its total', () => {
        expect(
            resolveStartupIntroOverlayContract({
                assetsReady: false,
                loadedSteps: 5,
                renderMode: 'three',
                skipPending: false,
                totalSteps: 3
            })
        ).toMatchObject({ progress: 1, progressPercent: 100 });
    });

    it('keeps slow asset failsafe bounded for a first-impression boot path', () => {
        expect(STARTUP_INTRO_ASSET_FAILSAFE_MS).toBeLessThanOrEqual(3500);
    });
});
