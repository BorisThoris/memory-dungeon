import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The Chromium to launch when the pinned build is not installed.
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` says it outright. Failing that, a runner that sets the standard
 * `PLAYWRIGHT_BROWSERS_PATH` usually has a browser under it, and taking that is what lets a gate
 * run from `yarn fullcheck` rather than only from a shell that happened to export a second
 * variable — a gate that cannot start is worse than no gate, because it reports as a failure
 * with nothing to say about the product.
 */
const resolveSystemChromium = (): string | null => {
    const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    if (explicit) {
        return explicit;
    }
    const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (!root || root === '0') {
        return null;
    }
    const candidate = join(root, 'chromium');
    return existsSync(candidate) ? candidate : null;
};

const systemChromiumPath = resolveSystemChromium();


const parsedWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? '', 10);
const workers = Number.isFinite(parsedWorkers) && parsedWorkers > 0 ? parsedWorkers : 1;

/** REF-079: fresh browser context per test is Playwright default; block SWs to avoid cross-test cache bleed. */
const config: PlaywrightTestConfig = {
    testDir: './e2e',
    /*
     * The app is a single strict-port Vite/WebGL target; broad parallel Playwright runs overload
     * startup, WebGL contexts, and route fixtures. Shards may opt into more workers through env.
     */
    fullyParallel: process.env.PLAYWRIGHT_FULLY_PARALLEL === '1',
    workers,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL: 'http://127.0.0.1:5173',
        /** Point at a system Chromium when the pinned browser build is not installed (remote runners). */
        ...(systemChromiumPath ? { launchOptions: { executablePath: systemChromiumPath } } : {}),
        serviceWorkers: 'block',
        /** Keeps CI artifacts smaller than `trace: 'on'` while preserving traces for flaky retries. */
        trace: 'retain-on-failure',
        video: 'retain-on-failure'
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                hasTouch: false,
                isMobile: false,
                viewport: { width: 1280, height: 720 }
            }
        }
    ],
    webServer: {
        command: 'cross-env E2E_DISABLE_HMR=1 yarn vite --host 127.0.0.1 --port 5173 --strictPort',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        /** Cold caches / busy agents: avoid false failures while Vite prebundles (default 60s is tight). */
        timeout: 180_000
    }
};

export default config;
