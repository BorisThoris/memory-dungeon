import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';

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
