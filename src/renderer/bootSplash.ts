/**
 * Teardown for the first-paint boot splash in `index.html`.
 *
 * The splash exists because every style the renderer owns ships inside the bundle: until that
 * parses there is nothing to paint but a white page. It sits above the startup intro (z-index
 * 10000 vs 9000) and is removed here once React has committed, so the player crosses from splash to
 * intro through a fade rather than a white flash and a snap.
 */

export const BOOT_SPLASH_ELEMENT_ID = 'boot-splash';

/** Matches the `#boot-splash` opacity transition in index.html. */
export const BOOT_SPLASH_FADE_MS = 420;

interface DismissBootSplashOptions {
    documentRef?: Document;
    /** Injected in tests; defaults to the real timer. */
    scheduleRemoval?: (callback: () => void, delayMs: number) => void;
}

const defaultScheduleRemoval = (callback: () => void, delayMs: number): void => {
    if (typeof window === 'undefined') {
        callback();
        return;
    }
    window.setTimeout(callback, delayMs);
};

/**
 * Fades the splash out and drops it from the DOM. Safe to call when the splash is absent (tests,
 * a shell that renders its own HTML) or already dismissed — both are no-ops.
 */
export const dismissBootSplash = ({
    documentRef = typeof document === 'undefined' ? undefined : document,
    scheduleRemoval = defaultScheduleRemoval
}: DismissBootSplashOptions = {}): void => {
    const splash = documentRef?.getElementById(BOOT_SPLASH_ELEMENT_ID);

    if (!splash || splash.dataset.bootSplash === 'dismissed') {
        return;
    }

    splash.dataset.bootSplash = 'dismissed';
    // Keep it out of the a11y tree for the whole fade; the intro behind it is the live region now.
    splash.setAttribute('aria-hidden', 'true');
    scheduleRemoval(() => {
        splash.remove();
    }, BOOT_SPLASH_FADE_MS);
};
