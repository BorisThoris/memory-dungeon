import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';

/**
 * The packaged desktop game reaches its main menu.
 *
 * Until 2026-11-16 nothing launched Electron: `gate:desktop-build` compiled the main process and
 * stopped. The window opened the web build over `file://`, every `/assets/...` request went to the
 * drive root, and the game sat on its boot splash for good while every gate stayed green. This
 * starts the built app (`yarn build:renderer && yarn build:electron` first) on a throwaway profile
 * and holds it to the menu, its own origin, the preload bridge and no local file that fails to load.
 * Run by `playwright.desktop.config.ts`; the browser suite's config ignores it.
 */
test('the desktop build boots to the main menu from app://game', async () => {
    const profile = mkdtempSync(join(tmpdir(), 'md-desktop-'));
    const app = await electron.launch({
        args: ['.', `--user-data-dir=${profile}`],
        timeout: 120_000
    });
    try {
        const window = await app.firstWindow({ timeout: 120_000 });
        const failedLocal: string[] = [];
        window.on('requestfailed', (request) => {
            if (request.url().startsWith('app://') || request.url().startsWith('file://')) {
                failedLocal.push(`${request.url()} ${request.failure()?.errorText ?? ''}`);
            }
        });
        const pageErrors: string[] = [];
        window.on('pageerror', (error) => pageErrors.push(String(error)));

        await expect(window.getByRole('button', { name: /^(Play|Continue)/ }).first()).toBeVisible({ timeout: 180_000 });
        expect(window.url()).toMatch(/^app:\/\/game\//);
        expect(await window.evaluate(() => typeof (window as unknown as { desktop?: unknown }).desktop)).toBe('object');
        expect(failedLocal, 'local files that failed to load').toEqual([]);
        expect(pageErrors, 'uncaught page errors').toEqual([]);
    } finally {
        await app.close();
        rmSync(profile, { recursive: true, force: true });
    }
});
