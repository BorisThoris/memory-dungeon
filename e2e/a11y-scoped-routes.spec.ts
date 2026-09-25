import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

const seriousOnly = (violations: { impact?: string | null }[]): typeof violations =>
    violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('a11y — scoped axe (REF-094)', () => {
    test.describe.configure({ timeout: 90_000 });

    test('main menu after intro: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });

    test('settings surface: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        await page.getByRole('button', { name: /settings/i }).click();
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 15_000 });
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });

    /*
     * The store stop, with a keyboard and a screen reader's ears. Measured before the fix: a buy
     * said nothing at all, the button that bought the last thing the gold covered went disabled
     * under focus and dropped it on <body>, and the board under the sheet was not inert.
     */
    test('store stop: axe clean, a keyboard buy is said once, focus survives, Escape descends', async ({ page }) => {
        test.setTimeout(240_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
        await page.waitForFunction(
            async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.status === 'playing',
            null,
            { timeout: 60_000, polling: 500 }
        );
        for (const pair of ['a', 'b']) {
            await page.evaluate(async (key) => {
                const store = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState();
                store.pressTile(`${key}-1`);
                store.pressTile(`${key}-2`);
            }, pair);
            await page.waitForTimeout(1200);
        }
        const sheet = page.getByTestId('store-sheet');
        await expect(sheet).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('[data-a11y-gameplay-inert="true"]')).toHaveCount(1);
        const { violations } = await new AxeBuilder({ page }).include('[data-testid="store-sheet"]').disableRules(['color-contrast']).analyze();
        expect(seriousOnly(violations)).toEqual([]);

        // Tab reaches a buy button from Descend; Enter buys it and the receipt says so, once.
        const bomb = page.getByTestId('store-buy-bomb');
        await expect(bomb).toHaveAccessibleName(/^Buy a bomb for \d+ gold$/);
        for (let step = 0; step < 8; step += 1) {
            if (await bomb.evaluate((node) => node === document.activeElement)) break;
            await page.keyboard.press('Tab');
        }
        await expect(bomb).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('store-receipt')).toHaveText(/^Bought a bomb\. \d+ gold left\.$/);

        // Keep buying bombs until the price outruns the purse: the button goes disabled under
        // focus, and focus has to go on to something still for sale, or Descend, never the page.
        for (let step = 0; step < 6 && (await bomb.isEnabled()); step += 1) {
            await bomb.focus();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(150);
        }
        await expect(bomb).toBeDisabled();
        const landing = await page.evaluate(() => {
            const active = document.activeElement as HTMLButtonElement | null;
            return {
                inSheet: Boolean(active?.closest('[data-testid="store-sheet"]')),
                enabled: active instanceof HTMLButtonElement && !active.disabled
            };
        });
        expect(landing, 'the spent buy button dropped focus on the page').toEqual({ inSheet: true, enabled: true });

        await page.keyboard.press('Escape');
        await expect(sheet).toBeHidden({ timeout: 20_000 });
    });

    test('in-run level 1: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        await page.getByRole('button', { name: /^play$/i }).click();
        await page.getByRole('button', { name: /start run/i }).click();
        await expect(page.getByRole('heading', { name: /level 1/i })).toBeVisible({ timeout: 30_000 });
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });
});
