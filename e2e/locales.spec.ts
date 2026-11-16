import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

/*
 * Each language boots, shows its menu, Settings and a run board with no console errors, and leaves
 * screenshots in test-results/locales/ to read (docs/LOCALIZATION_PLAN.md). Everything is found by
 * test id or store state, never by English text. The pseudo-locale run also lists any visible words
 * outside its [brackets]: plain English there is a string that never went through `tr`.
 */
const LOCALES = ['en-XA', 'de', 'ru', 'zh-Hans'] as const;
const OUT = 'test-results/locales';

test.beforeEach(async ({ page }) => {
    await page.route('https://memory-dungeon-scores.modaxxx009.workers.dev/record', (route) =>
        route.fulfill({ json: { record: { name: 'Test Record', score: Number.MAX_SAFE_INTEGER, at: '2026-10-11T00:00:00Z' } } })
    );
});

const untranslatedWords = (page: Page): Promise<string[]> =>
    page.evaluate(() => {
        const text = document.body.innerText.replace(/\[[^\]]*\]/gu, ' ');
        const words = text.match(/\b[A-Za-z]{4,}\b/gu) ?? [];
        return [...new Set(words)].slice(0, 80);
    });

for (const locale of LOCALES) {
    test(`${locale}: menu, settings and a board render translated`, async ({ page }) => {
        test.setTimeout(240_000);
        mkdirSync(OUT, { recursive: true });
        const errors: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') errors.push(message.text());
        });
        page.on('pageerror', (error) => errors.push(String(error)));

        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), `?lang=${locale}`);
        await expect(page.locator('html')).toHaveAttribute('lang', locale === 'en-XA' ? 'en' : locale, { timeout: 180_000 });
        // The startup intro takes Escape; the menu is ready once it accepts pointer input.
        await page.keyboard.press('Escape').catch(() => {});
        await expect(page.locator('[data-e2e-menu-pointer="interactive"]')).toBeAttached({ timeout: 60_000 });
        await page.screenshot({ path: `${OUT}/${locale}-menu.png` });
        const menuLeftovers = locale === 'en-XA' ? await untranslatedWords(page) : [];

        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            useAppStore.getState().openSettings('menu');
        });
        await expect(page.getByTestId('settings-category-menu')).toBeAttached({ timeout: 30_000 });
        await page.screenshot({ path: `${OUT}/${locale}-settings.png` });
        const settingsLeftovers = locale === 'en-XA' ? await untranslatedWords(page) : [];

        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            useAppStore.getState().goToMenu();
            useAppStore.getState().startRun(undefined as never);
        });
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 90_000 });
        await expect(page.getByTestId('tile-board-frame')).toBeVisible({ timeout: 90_000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${OUT}/${locale}-board.png` });
        const boardLeftovers = locale === 'en-XA' ? await untranslatedWords(page) : [];

        writeFileSync(
            `${OUT}/${locale}.json`,
            JSON.stringify({ errors, leftovers: { menu: menuLeftovers, settings: settingsLeftovers, board: boardLeftovers } }, null, 2)
        );
        expect(errors).toEqual([]);
    });
}
