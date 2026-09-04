import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { navigateToLevel1PlayPhase, openRunSettings } from './tileBoardGameFlow';
import { openMainMenuFromSave } from './visualScreenHelpers';

const OUT_DIR = join(process.cwd(), 'test-results', 'settings-viewport-matrix');

/** Page settings: width x height, filename tag, optional expected data-settings-layout after wide-short boundary fix. */
const PAGE_MATRIX: ReadonlyArray<{
    expectedLayout?: string;
    h: number;
    note: string;
    w: number;
}> = [
    { w: 844, h: 390, note: 'short-stacked', expectedLayout: 'short-stacked' },
    { w: 390, h: 844, note: 'stacked-portrait', expectedLayout: 'stacked' },
    { w: 962, h: 390, note: 'gap', expectedLayout: 'wide-short' },
    { w: 1000, h: 720, note: 'gap', expectedLayout: 'wide-short' },
    { w: 1023, h: 600, note: 'gap', expectedLayout: 'wide-short' },
    { w: 1280, h: 720, note: 'wide-short-ref', expectedLayout: 'wide-short' },
    { w: 1920, h: 1080, note: 'desktop-tall', expectedLayout: 'desktop' },
    { w: 2560, h: 1440, note: 'desktop-max', expectedLayout: 'desktop' },
    { w: 2560, h: 720, note: 'ultrawide-short', expectedLayout: 'wide-short' }
];

const MODAL_MATRIX: ReadonlyArray<{ expectedLayout?: string; h: number; note: string; w: number }> = [
    { w: 844, h: 390, note: 'short-stacked', expectedLayout: 'short-stacked' },
    { w: 962, h: 390, note: 'gap', expectedLayout: 'wide-short' },
    { w: 1000, h: 720, note: 'gap', expectedLayout: 'wide-short' },
    { w: 1023, h: 600, note: 'gap', expectedLayout: 'wide-short' },
    { w: 1280, h: 720, note: 'wide-short-ref', expectedLayout: 'wide-short' }
];

test.beforeAll(() => {
    mkdirSync(OUT_DIR, { recursive: true });
});

test.describe.configure({ mode: 'serial' });
/* Ultra-wide viewports can exceed 120s to reach main menu + settings on cold runs. */
test.setTimeout(180_000);

test.describe('Settings viewport matrix (screenshots)', () => {
    for (const { w, h, note, expectedLayout } of PAGE_MATRIX) {
        test(`page settings ${w}x${h} (${note})`, async ({ page }) => {
            await page.setViewportSize({ width: w, height: h });
            await openMainMenuFromSave(page, true);
            await page.getByRole('button', { name: /^settings$/i }).evaluate((el) => (el as HTMLButtonElement).click());
            await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
            const section = page
                .locator('section')
                .filter({ has: page.getByRole('heading', { name: /^settings$/i }) })
                .first();
            const layout = (await section.getAttribute('data-settings-layout')) ?? 'unknown';
            if (expectedLayout !== undefined) {
                await expect(section).toHaveAttribute('data-settings-layout', expectedLayout);
            }
            await page.screenshot({
                fullPage: true,
                path: join(OUT_DIR, `${w}x${h}-page-${layout}-${note}.png`)
            });
        });
    }

    for (const { w, h, note, expectedLayout } of MODAL_MATRIX) {
        test(`run settings modal ${w}x${h} (${note})`, async ({ page }) => {
            await page.setViewportSize({ width: w, height: h });
            await navigateToLevel1PlayPhase(page);
            await openRunSettings(page);
            const dialog = page.getByRole('dialog', { name: /run settings/i });
            await expect(dialog).toBeVisible();
            const layout = (await dialog.getAttribute('data-settings-layout')) ?? 'unknown';
            if (expectedLayout !== undefined) {
                await expect(dialog).toHaveAttribute('data-settings-layout', expectedLayout);
            }
            await page.screenshot({
                fullPage: true,
                path: join(OUT_DIR, `${w}x${h}-modal-${layout}-${note}.png`)
            });
        });
    }
});
