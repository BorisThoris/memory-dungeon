import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The offline check (`e2e/offline.spec.ts`): the service worker only runs in a production build,
 * so this serves `dist/` with `vite preview` instead of the dev server. Run through `gate:offline`,
 * after the build.
 */
const port = 4173;

const config: PlaywrightTestConfig = {
    testDir: './e2e',
    testMatch: 'offline.spec.ts',
    workers: 1,
    retries: 0,
    reporter: 'list',
    timeout: 300_000,
    use: { baseURL: `http://127.0.0.1:${port}`, serviceWorkers: 'allow', viewport: { width: 1280, height: 720 } },
    webServer: {
        command: `yarn vite preview --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}`,
        reuseExistingServer: false,
        timeout: 120_000
    }
};

export default config;
