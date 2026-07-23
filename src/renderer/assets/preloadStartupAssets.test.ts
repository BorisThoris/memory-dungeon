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

    it('contains rejected critical raster preloads and still returns relic assets', async () => {
        const relicTextureSet = { dispose: vi.fn() };
        preloadTileTextureImages.mockRejectedValueOnce(new Error('tile raster unavailable'));
        loadRelicTextures.mockResolvedValueOnce(relicTextureSet as never);
        const { preloadStartupCriticalAssets, resetStartupAssetPreloadStateForTests } = await import('./preloadStartupAssets');
        resetStartupAssetPreloadStateForTests();

        await expect(
            preloadStartupCriticalAssets({ relicSvgUrl: 'relic.svg', webgl: true })
        ).resolves.toEqual({ relicTextureSet });

        expect(loadRelicTextures).toHaveBeenCalledWith('relic.svg');
    });

    it('contains synchronous image-host failures during critical UI warm-up', async () => {
        vi.stubGlobal(
            'Image',
            class {
                constructor() {
                    throw new Error('image host unavailable');
                }
            }
        );
        Object.defineProperty(window, 'Image', {
            configurable: true,
            value: globalThis.Image
        });
        const { preloadStartupCriticalAssets, resetStartupAssetPreloadStateForTests } = await import('./preloadStartupAssets');
        resetStartupAssetPreloadStateForTests();

        await expect(
            preloadStartupCriticalAssets({ relicSvgUrl: 'relic.svg', webgl: false })
        ).resolves.toEqual({ relicTextureSet: null });
    });

    it('keeps mode poster rasters out of the startup-critical preload', async () => {
        const { preloadStartupCriticalAssets, resetStartupAssetPreloadStateForTests } = await import('./preloadStartupAssets');
        const { getUiArtRows, MODE_CARD_ART, MODE_POSTER_KEYS } = await import('./ui');
        resetStartupAssetPreloadStateForTests();

        await preloadStartupCriticalAssets({ relicSvgUrl: 'relic.svg', webgl: false });

        const criticalUiUrls = new Set(getUiArtRows().map((row) => row.assetUrl));
        const modePosterUrls = new Set(MODE_POSTER_KEYS.map((key) => MODE_CARD_ART[key]));

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
        const { getUiArtRows, MODE_CARD_ART, MODE_POSTER_KEYS, UI_ART, UI_ART_KEYS } = await import('./ui');
        resetStartupAssetPreloadStateForTests();

        await preloadUiRasterImages();
        expect(Object.keys(UI_ART)).toEqual([...UI_ART_KEYS]);
        expect(getUiArtRows().map((row) => row.key)).toEqual([...UI_ART_KEYS]);
        expect(requestedRasterUrls).toEqual([...new Set(getUiArtRows().map((row) => row.assetUrl))]);

        requestedRasterUrls = [];
        await preloadModePosterRasterImages();
        const expectedModePosterUrls = [
            ...new Set([...MODE_POSTER_KEYS.map((key) => MODE_CARD_ART[key]), MODE_CARD_ART.fallback])
        ];
        expect(requestedRasterUrls).toEqual(expectedModePosterUrls);

        requestedRasterUrls = [];
        warmCardIllustrationsInBackground();
        warmCardIllustrationsInBackground();
        warmModePosterRasterImagesInBackground();
        warmModePosterRasterImagesInBackground();

        expect(idleCallbacks.filter(Boolean)).toHaveLength(2);
        await runIdleCallback(0);
        await runIdleCallback(1);
        expect(preloadCardIllustrationImages).toHaveBeenCalledTimes(1);
        expect(requestedRasterUrls).toEqual(expectedModePosterUrls);
    }, 15000);

    it('allows a rejected background illustration warm-up to be scheduled again', async () => {
        preloadCardIllustrationImages.mockRejectedValueOnce(new Error('illustration host unavailable'));
        const {
            resetStartupAssetPreloadStateForTests,
            warmCardIllustrationsInBackground
        } = await import('./preloadStartupAssets');
        resetStartupAssetPreloadStateForTests();

        warmCardIllustrationsInBackground();
        await runIdleCallback(0);
        warmCardIllustrationsInBackground();

        expect(idleCallbacks.filter(Boolean)).toHaveLength(1);
        await runIdleCallback(1);
        expect(preloadCardIllustrationImages).toHaveBeenCalledTimes(2);
    });

    it('drops cancelled idle warmups when cancelIdleCallback is unavailable', async () => {
        Object.defineProperty(window, 'cancelIdleCallback', {
            configurable: true,
            value: undefined
        });
        const {
            resetStartupAssetPreloadStateForTests,
            warmCardIllustrationsInBackground
        } = await import('./preloadStartupAssets');
        resetStartupAssetPreloadStateForTests();

        warmCardIllustrationsInBackground();
        resetStartupAssetPreloadStateForTests();
        await runIdleCallback(0);

        expect(preloadCardIllustrationImages).not.toHaveBeenCalled();
    });

    it('falls back to timer warmups when requestIdleCallback throws', async () => {
        Object.defineProperty(window, 'requestIdleCallback', {
            configurable: true,
            value: vi.fn(() => {
                throw new Error('idle scheduler unavailable');
            })
        });
        const {
            resetStartupAssetPreloadStateForTests,
            warmCardIllustrationsInBackground
        } = await import('./preloadStartupAssets');
        resetStartupAssetPreloadStateForTests();

        warmCardIllustrationsInBackground();
        await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 300);
        });

        expect(preloadCardIllustrationImages).toHaveBeenCalledTimes(1);
    });
});
