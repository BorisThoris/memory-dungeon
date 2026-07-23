/**
 * Preloads raster URLs from {@link CARD_ILLUSTRATION_REGISTRY} so face overlays can draw
 * tarot panels via {@link drawIllustrationInCanvasOverlay} without waiting on first decode.
 */

import { runNonNegativeIntegerWithFallback } from '../../shared/run-number-guards';

const imagesByUrl = new Map<string, HTMLImageElement>();
const pendingImagesByUrl = new Map<string, Promise<void>>();

export interface PreloadCardIllustrationImagesOptions {
    concurrency?: number;
}

const DEFAULT_CARD_ILLUSTRATION_PRELOAD_CONCURRENCY = 4;
const CARD_ILLUSTRATION_PRELOAD_TIMEOUT_MS = 1500;

const normalizeConcurrency = (concurrency: number | undefined): number =>
    Math.max(1, runNonNegativeIntegerWithFallback(concurrency, DEFAULT_CARD_ILLUSTRATION_PRELOAD_CONCURRENCY));

export const preloadCardIllustrationImages = async (
    urls: readonly string[],
    options: PreloadCardIllustrationImagesOptions = {}
): Promise<void> => {
    const uniqueUrls = [...new Set(urls)];
    const workerCount = Math.min(normalizeConcurrency(options.concurrency), uniqueUrls.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
        while (cursor < uniqueUrls.length) {
            const url = uniqueUrls[cursor];
            cursor += 1;

            if (url) {
                await loadCardIllustrationImage(url);
            }
        }
    };

    await Promise.all(Array.from({ length: workerCount }, () => worker()));
};

function loadCardIllustrationImage(url: string): Promise<void> {
    const existing = imagesByUrl.get(url);
    if (existing?.naturalWidth) {
        return Promise.resolve();
    }

    const pending = pendingImagesByUrl.get(url);
    if (pending) {
        return pending;
    }

    const loadPromise = new Promise<void>((resolve) => {
        const img = new Image();
        let resolved = false;
        img.decoding = 'async';

        const resolveOnce = (): void => {
            if (resolved) {
                return;
            }

            resolved = true;
            globalThis.clearTimeout(timeoutHandle);
            resolve();
        };

        const finishLoaded = async (): Promise<void> => {
            try {
                await img.decode?.();
            } catch {
                /* Safari and partially cached images can reject decode after a successful load. */
            }
            imagesByUrl.set(url, img);
            resolveOnce();
        };

        img.onload = (): void => {
            void finishLoaded();
        };
        img.onerror = (): void => {
            resolveOnce();
        };
        const timeoutHandle = globalThis.setTimeout(resolveOnce, CARD_ILLUSTRATION_PRELOAD_TIMEOUT_MS);
        img.src = url;
    });

    pendingImagesByUrl.set(url, loadPromise);
    loadPromise.finally(() => {
        pendingImagesByUrl.delete(url);
    });

    return loadPromise;
}

/** Resolved asset URL → decoded image, if preload succeeded. */
export const getCardIllustrationImageByUrl = (url: string): HTMLImageElement | null =>
    imagesByUrl.get(url) ?? null;
