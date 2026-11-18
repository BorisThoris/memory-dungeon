/**
 * Offline play on the web and in the Android app (public/sw.js; docs/MARKET_FLOW_REVIEW_WIDER.md P0).
 *
 * Only a production web build registers it: never the dev server (it would cache modules under
 * hot reload), never the desktop build (it serves its files from disk through app://game), and
 * never a page that is not a secure context, where the browser refuses a worker anyway.
 */
export interface ServiceWorkerEnv {
    production: boolean;
    desktop: boolean;
    secureContext: boolean;
    supported: boolean;
    protocol: string;
}

export const shouldRegisterServiceWorker = (env: ServiceWorkerEnv): boolean =>
    env.production && !env.desktop && env.secureContext && env.supported && (env.protocol === 'https:' || env.protocol === 'http:');

/*
 * A tab (or the Play app) left open across a deploy asks for a lazy chunk the new build renamed
 * and gets a failed import. One reload loads the new build; the run is kept by the pagehide
 * snapshot. Once per session, so a chunk that is really missing cannot reload forever.
 */
export const STALE_CHUNK_RELOAD_KEY = 'memory-dungeon.stale-chunk-reload';

export const reloadOnStaleChunk = (target: Window = window): void => {
    target.addEventListener('vite:preloadError', (event) => {
        try {
            if (target.sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) === '1') return;
            target.sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1');
        } catch {
            return;
        }
        event.preventDefault();
        target.location.reload();
    });
};

export const registerServiceWorker = (): void => {
    const env: ServiceWorkerEnv = {
        production: import.meta.env.PROD,
        desktop: typeof window !== 'undefined' && window.desktop != null,
        secureContext: typeof window !== 'undefined' && window.isSecureContext,
        supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
        protocol: typeof location !== 'undefined' ? location.protocol : ''
    };
    if (!shouldRegisterServiceWorker(env)) {
        return;
    }
    // The default keeps 250 entries; the boot alone loads more than that, and the list is what the
    // worker is told to cache.
    performance.setResourceTimingBufferSize?.(2000);
    // After load, so installing the worker never competes with the boot for bandwidth.
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
            console.warn('[offline] service worker registration failed', error);
        });
        // Hand the worker every file this session used, now and after the idle-time art loads, so
        // even the first visit (loaded before the worker existed) is complete offline.
        const sendUsed = (): void => {
            void navigator.serviceWorker.ready.then((registration) => {
                const urls = performance
                    .getEntriesByType('resource')
                    .map((entry) => entry.name)
                    .filter((name) => name.startsWith(location.origin));
                registration.active?.postMessage({ type: 'cache-used', urls: [location.origin + '/', ...urls] });
            });
        };
        sendUsed();
        window.setTimeout(sendUsed, 20_000);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                sendUsed();
            }
        });
    });
};
