import type { PlaywrightTestConfig } from '@playwright/test';

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
        command: 'yarn vite --host 127.0.0.1 --port 5173 --strictPort',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        /** Cold caches / busy agents: avoid false failures while Vite prebundles (default 60s is tight). */
        timeout: 180_000
    }
};

export default config;
