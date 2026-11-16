import { expect, test, type Page } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

/*
 * The Android app's back button answers as Escape away from the menu
 * (src/renderer/hooks/useHardwareBack.ts): back from Settings returns to the menu, back in a run
 * pauses it instead of leaving the game, and back again resumes.
 */
test.beforeEach(async ({ page }) => {
    await page.route('https://memory-dungeon-scores.modaxxx009.workers.dev/record', (route) =>
        route.fulfill({ json: { record: { name: 'Test Record', score: Number.MAX_SAFE_INTEGER, at: '2026-10-11T00:00:00Z' } } })
    );
});

const storeState = (page: Page): Promise<{ view: string; status: string | null }> =>
    page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const { view, run } = useAppStore.getState();
        return { view, status: run?.status ?? null };
    });

test('back leaves a screen, pauses a run and never leaves the game mid-run', async ({ page }) => {
    test.setTimeout(240_000);
    // The guard runs only in the Android app or an installed web app; the query stands in for both.
    await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), '?backGuard=1');
    await page.keyboard.press('Escape').catch(() => {});
    await expect(page.locator('[data-e2e-menu-pointer="interactive"]')).toBeAttached({ timeout: 120_000 });
    const origin = new URL(page.url()).origin;

    await page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        useAppStore.getState().openSettings('menu');
    });
    await expect.poll(async () => (await storeState(page)).view).toBe('settings');
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await expect.poll(async () => (await storeState(page)).view, { timeout: 20_000 }).toBe('menu');
    expect(new URL(page.url()).origin).toBe(origin);

    await page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        useAppStore.getState().startRun(undefined as never);
    });
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 90_000 });
    await expect.poll(async () => (await storeState(page)).status, { timeout: 60_000 }).toMatch(/playing|memorize/);
    await page.goBack({ waitUntil: 'commit' }).catch(() => {});
    await expect.poll(async () => (await storeState(page)).status, { timeout: 20_000 }).toBe('paused');
    expect((await storeState(page)).view).toBe('playing');
    expect(new URL(page.url()).origin).toBe(origin);
});
