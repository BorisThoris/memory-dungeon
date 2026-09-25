import { getAllCardIllustrationUrls } from '../cardFace/cardIllustrationRegistry';
import { preloadCardIllustrationImages } from '../cardFace/cardIllustrationImages';
import { preloadTileTextureImages } from '../components/tileTextures';
import { loadRelicTextures, type RelicTextureSet } from '../components/startupIntroTextures';
import { getUiArtRows, MODE_CARD_ART, MODE_POSTER_KEYS } from './ui';
import { getSceneSpriteSheetUrls } from './ui/sprites';

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

const settleRasterPreload = async (operation: () => Promise<void>): Promise<void> => {
    try {
        await operation();
    } catch {
        // Raster warm-up is optional; callers retain CSS/canvas fallbacks.
    }
};

const scheduleIdleWarmup = (callback: () => void, fallbackDelayMs: number): (() => void) => {
    const idleWindow = window as IdleWindow;
    let cancelled = false;
    const run = (): void => {
        if (!cancelled) {
            callback();
        }
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
        try {
            const idleHandle = idleWindow.requestIdleCallback(run, { timeout: 2500 });
            return () => {
                cancelled = true;
                idleWindow.cancelIdleCallback?.(idleHandle);
            };
        } catch {
            // Some embedded browser shells expose requestIdleCallback but reject scheduling.
        }
    }

    const timerHandle = window.setTimeout(run, fallbackDelayMs);
    return () => {
        cancelled = true;
        window.clearTimeout(timerHandle);
    };
};

/** Deduped first-screen UI rasters (backdrops, their light layers, the sprite strips that play over them) so MainMenu and gameplay shells decode before first paint. */
export const preloadUiRasterImages = (): Promise<void> => {
    const urls = [...getUiArtRows().map((row) => row.assetUrl), ...getSceneSpriteSheetUrls()];
    return preloadRasterUrls(urls, 4);
};

/**
 * Decoded images kept alive for the whole session. A browser may drop a decoded image from memory once
 * nothing refers to it, and then decode it again - or fetch it again - on first paint. The run
 * preloader (`preloadRunAssets`) holds on to what it loaded so the board and the scene never do.
 */
const retainedImages = new Map<string, HTMLImageElement>();

const loadAndDecodeRaster = (url: string, timeoutMs: number): Promise<void> => {
    if (retainedImages.has(url)) return Promise.resolve();
    return new Promise((resolve) => {
        const image = new Image();
        image.decoding = 'async';
        const timer = window.setTimeout(resolve, timeoutMs);
        const done = (): void => {
            window.clearTimeout(timer);
            resolve();
        };
        image.onload = () => {
            retainedImages.set(url, image);
            void (image.decode?.() ?? Promise.resolve()).catch(() => undefined).then(done);
        };
        image.onerror = done;
        image.src = url;
    });
};

/** The gameplay scene's backdrops, light layers and sprite strips, loaded, decoded and held (not the boot's 250ms glance). */
export const preloadUiRasterImagesFully = async (timeoutMs = 6000): Promise<void> => {
    const urls = [...new Set([...getUiArtRows().map((row) => row.assetUrl), ...getSceneSpriteSheetUrls()])];
    let cursor = 0;
    const worker = async (): Promise<void> => {
        while (cursor < urls.length) {
            const url = urls[cursor];
            cursor += 1;
            if (url) await loadAndDecodeRaster(url, timeoutMs);
        }
    };
    await Promise.all(Array.from({ length: Math.min(4, urls.length) }, () => worker()));
};

export const preloadModePosterRasterImages = (): Promise<void> => {
    const urls = [...MODE_POSTER_KEYS.map((key) => MODE_CARD_ART[key]), MODE_CARD_ART.fallback];
    return preloadRasterUrls(urls, 3);
};

export const warmModePosterRasterImagesInBackground = (): void => {
    if (modePosterPreloadStarted || typeof window === 'undefined') {
        return;
    }

    modePosterPreloadStarted = true;
    cancelModePosterWarmup = scheduleIdleWarmup(() => {
        cancelModePosterWarmup = null;
        void preloadModePosterRasterImages().catch(() => {
            modePosterPreloadStarted = false;
        });
    }, 350);
};

export const warmCardIllustrationsInBackground = (): void => {
    if (cardIllustrationPreloadStarted || typeof window === 'undefined') {
        return;
    }

    cardIllustrationPreloadStarted = true;
    const run = (): void => {
        cancelCardIllustrationWarmup = null;
        void preloadCardIllustrationImages(getAllCardIllustrationUrls()).catch(() => {
            cardIllustrationPreloadStarted = false;
        });
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

/** One per tracked boot step, in the order the loading rail reports them. */
export type StartupPreloadStepId = 'tiles' | 'interface' | 'relic';

export interface StartupPreloadProgress {
    /** Steps finished so far, out of `total`. */
    completed: number;
    /** Player-facing copy for the step that just landed. */
    label: string;
    step: StartupPreloadStepId;
    total: number;
}

const STARTUP_PRELOAD_STEP_LABELS: Record<StartupPreloadStepId, string> = {
    interface: 'Unrolling the interface…',
    relic: 'Waking the relic…',
    tiles: 'Cutting the tiles…'
};

/**
 * Copy for the rail before any step has landed. Exported so the overlay and its tests share one
 * source of truth for the "nothing has finished yet" state.
 */
export const STARTUP_PRELOAD_INITIAL_LABEL = 'Descending…';

export const STARTUP_PRELOAD_STEP_TOTAL = 3;

interface PreloadStartupCriticalAssetsOptions {
    /** Called as each tracked step settles; never called after the returned promise resolves. */
    onProgress?: (progress: StartupPreloadProgress) => void;
    relicSvgUrl: string;
    webgl: boolean;
}

interface PreloadStartupCriticalAssetsResult {
    relicTextureSet: RelicTextureSet | null;
}

/**
 * Tiles, card illustrations, UI backgrounds, and (when WebGL) relic SVG→texture for the startup intro.
 * Raster failures resolve so boot cannot deadlock; relic parse failure yields null (caller shows fallback).
 *
 * Steps report as they settle rather than in a fixed order, so the rail reflects real work landing.
 * A failed step still counts as completed — the rail tracks "no longer waiting on this", not success,
 * or a broken asset would strand the bar short of full while the intro plays on regardless.
 */
export const preloadStartupCriticalAssets = async (
    options: PreloadStartupCriticalAssetsOptions
): Promise<PreloadStartupCriticalAssetsResult> => {
    let completed = 0;
    const reportStep = (step: StartupPreloadStepId): void => {
        completed += 1;
        options.onProgress?.({
            completed,
            label: STARTUP_PRELOAD_STEP_LABELS[step],
            step,
            total: STARTUP_PRELOAD_STEP_TOTAL
        });
    };
    const track = async <T,>(step: StartupPreloadStepId, operation: Promise<T>): Promise<T> => {
        const result = await operation;
        reportStep(step);
        return result;
    };

    const relicPromise: Promise<RelicTextureSet | null> = options.webgl
        ? loadRelicTextures(options.relicSvgUrl).catch(() => null)
        : Promise.resolve(null);

    const [, , relicTextureSet] = await Promise.all([
        track('tiles', settleRasterPreload(preloadTileTextureImages)),
        track('interface', settleRasterPreload(preloadUiRasterImages)),
        track('relic', relicPromise)
    ]);

    warmCardIllustrationsInBackground();
    warmModePosterRasterImagesInBackground();

    return { relicTextureSet };
};
