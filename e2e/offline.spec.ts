import { expect, test } from '@playwright/test';

/*
 * The game plays without a connection after one visit (public/sw.js). Load the production build
 * and let the service worker take the page; the boot preloads every asset a run uses
 * (preloadRunAssets.ts), so that visit fills the cache. Then go offline and reload: the game must
 * boot to its menu from the cache with no request that failed for want of the network. Run by
 * `gate:offline` against `vite preview`.
 */
test('the game reloads and starts a run with no connection', async ({ context, page }) => {
    await page.route('https://memory-dungeon-scores.modaxxx009.workers.dev/**', (route) => route.abort());
    await page.goto('/', { timeout: 180_000 });
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, {
        timeout: 60_000
    });
    // The worker controls the page from a load after it activated; a slow headless start can need a second.
    await expect
        .poll(
            async () => {
                if (await page.evaluate(() => navigator.serviceWorker.controller !== null)) return true;
                await page.goto('/', { timeout: 180_000 });
                return page.evaluate(() => navigator.serviceWorker.controller !== null);
            },
            { timeout: 120_000, intervals: [1000, 3000, 5000] }
        )
        .toBe(true);
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 120_000 });
    // Some art loads at idle after the menu shows. Wait for the session to go quiet, then until
    // every file it fetched is in the worker's cache: offline must serve all of them.
    const fetched = new Set<string>();
    page.on('requestfinished', (request) => {
        const url = request.url();
        if (url.startsWith('http://127.0.0.1:4173/') && !url.endsWith('/sw.js')) fetched.add(url.split('#')[0]!);
    });
    await page.waitForLoadState('networkidle', { timeout: 120_000 });
    await page.waitForTimeout(8000);
    await expect
        .poll(
            () =>
                page.evaluate(async (urls) => {
                    // Everything this page loaded, including what came before the test listened.
                    const all = new Set([
                        ...urls,
                        ...performance.getEntriesByType('resource').map((entry) => entry.name),
                        ...[...document.querySelectorAll<HTMLScriptElement>('script[src]')].map((script) => script.src),
                        ...[...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"], link[rel="modulepreload"]')].map((link) => link.href)
                    ]);
                    const missing: string[] = [];
                    for (const url of all) {
                        if (!url.startsWith(location.origin) || url.endsWith('/sw.js')) continue;
                        if (!(await caches.match(url, { ignoreVary: true }))) missing.push(url);
                    }
                    return missing.filter((url) => !new URL(url).pathname.match(/^\/(?:trailers|artwork|wip-assets|privacy)/));
                }, [...fetched]),
            { timeout: 60_000 }
        )
        .toEqual([]);

    await context.setOffline(true);
    const failed: string[] = [];
    const aborted: string[] = [];
    page.on('requestfailed', (request) => {
        if (!request.url().startsWith('http://127.0.0.1')) return;
        const reason = request.failure()?.errorText ?? '';
        // A media element that drops its own preload aborts the request; that is the page's choice,
        // not the network's, and happens online too. Those files must still be in the cache.
        if (reason.includes('ERR_ABORTED')) aborted.push(request.url());
        else failed.push(`${request.url()} ${reason}`);
    });
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 300)));
    await page.reload({ timeout: 120_000 });
    await expect
        .poll(() => page.locator('#boot-splash').count(), {
            timeout: 120_000,
            message: `boot never finished offline; failed: ${JSON.stringify(failed)}; console: ${JSON.stringify(consoleErrors)}`
        })
        .toBe(0);
    await expect(page.locator('[data-e2e-menu-pointer]')).toBeAttached({ timeout: 60_000 });
    expect(failed).toEqual([]);
    const uncached = await page.evaluate(async (urls) => {
        const missing: string[] = [];
        for (const url of urls) if (!(await caches.match(url, { ignoreVary: true }))) missing.push(url);
        return missing;
    }, aborted);
    expect(uncached).toEqual([]);
    await context.setOffline(false);
});
