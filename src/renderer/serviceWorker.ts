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
    // After load, so installing the worker never competes with the boot for bandwidth.
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
            console.warn('[offline] service worker registration failed', error);
        });
    });
};
