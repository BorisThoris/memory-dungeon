import path from 'node:path';

/**
 * The packaged game is served from `app://game/`, not `file://`.
 *
 * The renderer is the same build the web deployment serves, so it asks for `/assets/main-*.js`,
 * `/audio/...` and the rest from the site root. Under `file://` that root is the drive
 * (`file:///C:/assets/...`), every script and stylesheet 404s and the window stays on the boot
 * splash forever; that is how the desktop build shipped until 2026-11-16. A standard, secure scheme
 * of our own gives the page a real origin whose root is `dist/`, so the web build runs unchanged
 * and the CSP's `'self'` means the game's own files.
 */
export const APP_SCHEME = 'app';
export const APP_HOST = 'game';
export const APP_ENTRY_URL = `${APP_SCHEME}://${APP_HOST}/index.html`;

export const APP_SCHEME_PRIVILEGES = {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    stream: true,
    codeCache: true
} as const;

/**
 * The file under `distDir` an `app://` request names, or null when it names nothing we serve: another
 * host, a path that climbs out of `dist/`, or a URL that does not parse. The root serves the entry page.
 */
export const resolveAppRequestPath = (distDir: string, requestUrl: string): string | null => {
    let url: URL;
    try {
        url = new URL(requestUrl);
    } catch {
        return null;
    }
    if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST) {
        return null;
    }
    let pathname: string;
    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        return null;
    }
    if (pathname.includes('\0')) {
        return null;
    }
    const relative = pathname === '/' || pathname === '' ? 'index.html' : pathname.replace(/^\/+/, '');
    const root = path.resolve(distDir);
    const resolved = path.resolve(root, relative);
    const inside = path.relative(root, resolved);
    if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
        return null;
    }
    return resolved;
};
