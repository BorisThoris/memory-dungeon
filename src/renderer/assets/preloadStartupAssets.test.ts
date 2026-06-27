import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const preloadCardIllustrationImages = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const getAllCardIllustrationUrls = vi.hoisted(() => vi.fn(() => ['card-a.png', 'card-b.png']));
const preloadTileTextureImages = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const loadRelicTextures = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));

vi.mock('../cardFace/cardIllustrationImages', () => ({
    preloadCardIllustrationImages
}));

vi.mock('../cardFace/cardIllustrationRegistry', () => ({
    getAllCardIllustrationUrls
}));

vi.mock('../components/tileTextures', () => ({
    preloadTileTextureImages
}));

vi.mock('../components/startupIntroTextures', () => ({
    loadRelicTextures
}));

class MockImage {
    decoding: 'async' | 'auto' | 'sync' = 'auto';
    onerror: (() => void) | null = null;
    onload: (() => void) | null = null;

    set src(value: string) {
        requestedRasterUrls.push(value);
        this.onload?.();
    }
}

let requestedRasterUrls: string[] = [];

describe('preloadStartupCriticalAssets', () => {
    const originalImage = globalThis.Image;
    const originalWindowImage = window.Image;
    const originalRequestIdleCallback = window.requestIdleCallback;
    const originalCancelIdleCallback = window.cancelIdleCallback;
    let idleCallbacks: Array<IdleRequestCallback | null> = [];

    const runIdleCallback = async (index: number): Promise<void> => {
        const callback = idleCallbacks[index];
        expect(callback).toBeTypeOf('function');
        idleCallbacks[index] = null;
        callback?.({
            didTimeout: false,
            timeRemaining: () => 50
        } as IdleDeadline);
        for (let i = 0; i < 5; i += 1) {
            await Promise.resolve();
        }
    };

    beforeEach(() => {
        vi.resetModules();
        preloadCardIllustrationImages.mockClear();
        getAllCardIllustrationUrls.mockClear();
        preloadTileTextureImages.mockClear();
        loadRelicTextures.mockClear();
        requestedRasterUrls = [];
        idleCallbacks = [];
        vi.stubGlobal('Image', MockImage);
        Object.defineProperty(window, 'Image', {
            configurable: true,
            value: MockImage
        });
        Object.defineProperty(window, 'requestIdleCallback', {
            configurable: true,
            value: ((callback: IdleRequestCallback) => {
                idleCallbacks.push(callback);
                return idleCallbacks.length - 1;
            }) as typeof window.requestIdleCallback
        });
        Object.defineProperty(window, 'cancelIdleCallback', {
            configurable: true,
            value: ((handle: number) => {
                idleCallbacks[handle] = null;
            }) as typeof window.cancelIdleCallback
        });
    });

    afterEach(() => {
        Object.defineProperty(globalThis, 'Image', {
            configurable: true,
            value: originalImage
        });
        vi.unstubAllGlobals();
        Object.defineProperty(window, 'Image', {
            configurable: true,
            value: originalWindowImage
        });
        Object.defineProperty(window, 'requestIdleCallback', {
            configurable: true,
            value: originalRequestIdleCallback
        });
        Object.defineProperty(window, 'cancelIdleCallback', {
            configurable: true,
            value: originalCancelIdleCallback
        });
    });

    it('does not block startup on the full card illustration preload', async () => {
        const { preloadStartupCriticalAssets, resetStartupAssetPreloadStateForTests } = await import('./preloadStartupAssets');
        resetStartupAssetPreloadStateForTests();

        await preloadStartupCriticalAssets({ relicSvgUrl: 'relic.svg', webgl: false });

        expect(preloadTileTextureImages).toHaveBeenCalledTimes(1);
        expect(loadRelicTextures).not.toHaveBeenCalled();
        expect(preloadCardIllustrationImages).not.toHaveBeenCalled();

        await runIdleCallback(0);
        expect(getAllCardIllustrationUrls).toHaveBeenCalledTimes(1);
        expect(preloadCardIllustrationImages).toHaveBeenCalledWith(['card-a.png', 'card-b.png']);
    }, 15000);

    it('keeps mode poster rasters out of the startup-critical preload', async () => {
        const { preloadStartupCriticalAssets, resetStartupAssetPreloadStateForTests } = await import('./preloadStartupAssets');
        const { MODE_CARD_ART, UI_ART } = await import('./ui');
        resetStartupAssetPreloadStateForTests();

        await preloadStartupCriticalAssets({ relicSvgUrl: 'relic.svg', webgl: false });

        const criticalUiUrls = new Set(Object.values(UI_ART));
        const modePosterUrls = new Set(Object.values(MODE_CARD_ART));

        const startupCriticalRequests = requestedRasterUrls.slice(0, criticalUiUrls.size);
        expect(startupCriticalRequests).toEqual([...criticalUiUrls]);
        expect(startupCriticalRequests.some((url) => modePosterUrls.has(url))).toBe(false);

        if (requestedRasterUrls.length <= criticalUiUrls.size) {
            await runIdleCallback(1);
        }
        expect(requestedRasterUrls.length).toBeGreaterThan(criticalUiUrls.size);
    }, 15000);

    it('exposes direct raster preload and background warmup helpers for shell orchestration', async () => {
        const {
            preloadModePosterRasterImages,
            preloadUiRasterImages,
            resetStartupAssetPreloadStateForTests,
            warmCardIllustrationsInBackground,
            warmModePosterRasterImagesInBackground
        } = await import('./preloadStartupAssets');
        const { MODE_CARD_ART, UI_ART } = await import('./ui');
        resetStartupAssetPreloadStateForTests();

        await preloadUiRasterImages();
        expect(requestedRasterUrls).toEqual([...new Set(Object.values(UI_ART))]);

        requestedRasterUrls = [];
        await preloadModePosterRasterImages();
        expect(requestedRasterUrls).toEqual([...new Set([...Object.values(MODE_CARD_ART), MODE_CARD_ART.fallback])]);

        requestedRasterUrls = [];
        warmCardIllustrationsInBackground();
        warmCardIllustrationsInBackground();
        warmModePosterRasterImagesInBackground();
        warmModePosterRasterImagesInBackground();

        expect(idleCallbacks.filter(Boolean)).toHaveLength(2);
        await runIdleCallback(0);
        await runIdleCallback(1);
        expect(preloadCardIllustrationImages).toHaveBeenCalledTimes(1);
        expect(requestedRasterUrls).toEqual([...new Set([...Object.values(MODE_CARD_ART), MODE_CARD_ART.fallback])]);
    }, 15000);
});
