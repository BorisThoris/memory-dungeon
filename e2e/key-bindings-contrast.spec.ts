import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { buildVisualSaveJson, gotoWithSave, openLevel1PlayWithSave, waitLevel1PlayReady } from './visualScreenHelpers';

/**
 * Rebound keys and High Contrast in the real app (2026-11-13): a save whose pause is on O pauses on
 * O and not on P, and a save with High Contrast on puts it on <html>, where the portaled Settings
 * dialog reads it. The Settings pages are captured for a look in `test-results/keys-contrast/`.
 */
const withSettings = (patch: Record<string, unknown>): string => {
    const save = JSON.parse(buildVisualSaveJson(true)) as { settings: Record<string, unknown> };
    save.settings = { ...save.settings, ...patch };
    return JSON.stringify(save);
};

const shots = join(process.cwd(), 'test-results', 'keys-contrast');

const shoot = async (page: Page, name: string): Promise<void> => {
    mkdirSync(shots, { recursive: true });
    await page.screenshot({ path: join(shots, `${name}.png`) });
};

test.describe('rebound keys and High Contrast', () => {
    test.describe.configure({ timeout: 300_000 });

    test('a rebound pause key pauses the run, and the old one no longer does', async ({ page }) => {
        await openLevel1PlayWithSave(page, withSettings({ keyBindings: { pause: 'KeyO' } }));
        await waitLevel1PlayReady(page);
        const pause = page.getByTestId('game-pause-overlay');
        await page.keyboard.press('p');
        await page.waitForTimeout(800);
        await expect(pause).toBeHidden();
        await page.keyboard.press('o');
        await expect(pause).toBeVisible();
    });

    test('High Contrast reaches the document, and the new Settings pages read well', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await gotoWithSave(page, withSettings({ highContrast: true }));
        await dismissStartupIntro(page);
        await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
        const muted = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--theme-text-muted').trim());
        expect(muted).toBe('#f4ecdc');

        await page.getByRole('button', { name: /settings/i }).first().click();
        await page.getByRole('button', { name: /^accessibility/i }).click();
        await expect(page.getByRole('checkbox', { name: /high contrast/i })).toBeChecked();
        await shoot(page, 'accessibility-high-contrast');

        await page.getByRole('button', { name: /^controls/i }).click();
        await page.getByRole('button', { name: /^keys$/i }).click();
        await expect(page.getByTestId('settings-key-bindings')).toBeVisible();
        await shoot(page, 'controls-keys');

        await page.getByRole('button', { name: /^about/i }).click();
        await page.getByRole('button', { name: /what’s new/i }).click();
        await expect(page.getByTestId('settings-patch-notes')).toContainText('Week of 2026-11-09');
        await shoot(page, 'about-whats-new');

        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(600);
        await shoot(page, 'about-whats-new-phone');
    });
});
