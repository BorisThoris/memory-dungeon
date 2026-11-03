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

/**
 * WebGL on the GPU. Headless Chromium otherwise renders WebGL in SwiftShader on the CPU: on the
 * owner's RTX 3090, inside the isolated test window station, a 1080p shader frame took 216 ms in
 * SwiftShader and 0.75 ms on D3D11. 2D canvas stays on the CPU so canvas hashes do not change.
 * Windows only (other hosts keep Playwright's defaults); PLAYWRIGHT_GPU=0 turns it off.
 */
const gpuWebglArgs =
    process.platform === 'win32' && !systemChromiumPath && process.env.PLAYWRIGHT_GPU !== '0'
        ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-accelerated-2d-canvas']
        : [];

/** PLAYWRIGHT_PORT lets parallel agent sessions each run the suite on their own dev server. */
const parsedPort = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '', 10);
const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5173;
const baseURL = `http://127.0.0.1:${port}`;


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
        headless: true,
        baseURL,
        /** Point at a system Chromium when the pinned browser build is not installed (remote runners). */
        ...(systemChromiumPath ? { launchOptions: { executablePath: systemChromiumPath } } : {}),
        ...(gpuWebglArgs.length ? { launchOptions: { args: gpuWebglArgs } } : {}),
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
        command: `cross-env E2E_DISABLE_HMR=1 yarn vite --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        /** Cold caches / busy agents: avoid false failures while Vite prebundles (default 60s is tight). */
        timeout: 180_000
    }
};

export default config;
