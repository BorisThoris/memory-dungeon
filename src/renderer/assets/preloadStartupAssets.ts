import { getAllCardIllustrationUrls } from '../cardFace/cardIllustrationRegistry';
import { preloadCardIllustrationImages } from '../cardFace/cardIllustrationImages';
import { preloadTileTextureImages } from '../components/tileTextures';
import { loadRelicTextures, type RelicTextureSet } from '../components/startupIntroTextures';
import { MODE_CARD_ART, UI_ART } from './ui';

type IdleWindow = Window &
    typeof globalThis & {
        requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
        cancelIdleCallback?: (handle: number) => void;
    };

let cardIllustrationPreloadStarted = false;
let modePosterPreloadStarted = false;
let cancelCardIllustrationWarmup: (() => void) | null = null;
let cancelModePosterWarmup: (() => void) | null = null;

const RASTER_PRELOAD_TIMEOUT_MS = 250;

const preloadRasterUrl = (url: string): Promise<void> =>
    new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        const finish = (): void => {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timeoutHandle);
            image.onload = null;
            image.onerror = null;
            resolve();
        };
        const timeoutHandle = window.setTimeout(finish, RASTER_PRELOAD_TIMEOUT_MS);
        image.decoding = 'async';
        image.onload = finish;
        image.onerror = finish;
        image.src = url;
    });

const preloadRasterUrls = async (urls: readonly string[], concurrency = 4): Promise<void> => {
    const uniqueUrls = [...new Set(urls)];
    const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), uniqueUrls.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
        while (cursor < uniqueUrls.length) {
            const url = uniqueUrls[cursor];
            cursor += 1;
            if (url) {
                await preloadRasterUrl(url);
            }
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
};

const scheduleIdleWarmup = (callback: () => void, fallbackDelayMs: number): (() => void) => {
    const idleWindow = window as IdleWindow;

    if (typeof idleWindow.requestIdleCallback === 'function') {
        const idleHandle = idleWindow.requestIdleCallback(callback, { timeout: 2500 });
        return () => idleWindow.cancelIdleCallback?.(idleHandle);
    }

    const timerHandle = window.setTimeout(callback, fallbackDelayMs);
    return () => window.clearTimeout(timerHandle);
};

/** Deduped first-screen UI rasters so MainMenu and gameplay shells decode before first paint. */
export const preloadUiRasterImages = (): Promise<void> => {
    const urls = [...Object.values(UI_ART)];
    return preloadRasterUrls(urls, 4);
};

export const preloadModePosterRasterImages = (): Promise<void> => {
    const urls = [...Object.values(MODE_CARD_ART), MODE_CARD_ART.fallback];
    return preloadRasterUrls(urls, 3);
};

export const warmModePosterRasterImagesInBackground = (): void => {
    if (modePosterPreloadStarted || typeof window === 'undefined') {
        return;
    }

    modePosterPreloadStarted = true;
    cancelModePosterWarmup = scheduleIdleWarmup(() => {
        cancelModePosterWarmup = null;
        void preloadModePosterRasterImages().catch(() => undefined);
    }, 350);
};

export const warmCardIllustrationsInBackground = (): void => {
    if (cardIllustrationPreloadStarted || typeof window === 'undefined') {
        return;
    }

    cardIllustrationPreloadStarted = true;
    const run = (): void => {
        cancelCardIllustrationWarmup = null;
        void preloadCardIllustrationImages(getAllCardIllustrationUrls()).catch(() => undefined);
    };
    cancelCardIllustrationWarmup = scheduleIdleWarmup(run, 250);
};

export const resetStartupAssetPreloadStateForTests = (): void => {
    cancelCardIllustrationWarmup?.();
    cancelModePosterWarmup?.();
    cancelCardIllustrationWarmup = null;
    cancelModePosterWarmup = null;
    cardIllustrationPreloadStarted = false;
    modePosterPreloadStarted = false;
};

export interface PreloadStartupCriticalAssetsOptions {
    relicSvgUrl: string;
    webgl: boolean;
}

export interface PreloadStartupCriticalAssetsResult {
    relicTextureSet: RelicTextureSet | null;
}

/**
 * Tiles, card illustrations, UI backgrounds, and (when WebGL) relic SVG→texture for the startup intro.
 * Raster failures resolve so boot cannot deadlock; relic parse failure yields null (caller shows fallback).
 */
export const preloadStartupCriticalAssets = async (
    options: PreloadStartupCriticalAssetsOptions
): Promise<PreloadStartupCriticalAssetsResult> => {
    const relicPromise: Promise<RelicTextureSet | null> = options.webgl
        ? loadRelicTextures(options.relicSvgUrl).catch(() => null)
        : Promise.resolve(null);

    const [, , relicTextureSet] = await Promise.all([
        preloadTileTextureImages(),
        preloadUiRasterImages(),
        relicPromise
    ]);

    warmCardIllustrationsInBackground();
    warmModePosterRasterImagesInBackground();

    return { relicTextureSet };
};
