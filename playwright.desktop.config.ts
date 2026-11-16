import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The desktop launch check (`e2e/desktop-launch.spec.ts`): Electron starts the built app itself, so
 * there is no dev server and no browser project. Run through `gate:desktop-build`, after the build.
 */
const config: PlaywrightTestConfig = {
    testDir: './e2e',
    testMatch: 'desktop-launch.spec.ts',
    workers: 1,
    retries: 0,
    reporter: 'list',
    timeout: 300_000
};

export default config;
