import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { navigateToLevel1PlayPhase } from './tileBoardGameFlow';
import { completeLevel1Play } from './visualScreenHelpers';

/**
 * OVR-013 — CI-friendly overlay smoke (not full visual-inventory):
 * pause modal, in-run settings, floor-cleared, achievement toast rail, mobile camera flag.
 * Pixel diff is out of scope; set `OVERLAY_SMOKE_SCREENSHOT=1` to write PNGs under `test-results/overlay-smoke/`.
 */
test.describe('OVR-013 — overlay smoke', () => {
    test.describe.configure({ retries: 1 });

    test('level 1: pause, run settings, floor cleared, toast surface, mobile camera', async ({ page }) => {
        /* Level 1 completion can span memorize → play → match resolution; allow headroom under load (retries: 1). */
        test.setTimeout(180_000);

        await page.setViewportSize({ width: 390, height: 844 });
        const pairs = await navigateToLevel1PlayPhase(page);

        /* Toast host stays in DOM while `visibility`/a11y hidden when empty — assert structure, not pixels. */
        const tipsRegion = page.getByRole('region', { name: /memory dungeon tips/i });
        await expect(tipsRegion).toBeAttached();

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute('data-mobile-camera-mode', 'true');

        await page.keyboard.press('p');
        const pauseOverlay = page.getByTestId('game-pause-overlay');
        await expect(pauseOverlay).toBeVisible();
        await expect(page.getByRole('dialog', { name: /run paused/i })).toBeVisible();

        if (process.env.OVERLAY_SMOKE_SCREENSHOT === '1') {
            const outDir = join(process.cwd(), 'test-results', 'overlay-smoke');
            mkdirSync(outDir, { recursive: true });
            await page.screenshot({ path: join(outDir, 'pause.png'), fullPage: true });
        }

        await pauseOverlay.getByRole('button', { name: /^resume$/i }).click();
        await expect(pauseOverlay).toBeHidden();

        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const runSettings = page.getByRole('dialog', { name: /run settings/i });
        await expect(runSettings).toBeVisible();
        await runSettings.getByRole('button', { name: /^back$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        await expect(runSettings).toBeHidden();

        await completeLevel1Play(page, pairs);

        const floorCleared = page.getByRole('dialog', { name: /floor cleared/i });
        await expect(floorCleared).toBeVisible();

        if (process.env.OVERLAY_SMOKE_SCREENSHOT === '1') {
            const outDir = join(process.cwd(), 'test-results', 'overlay-smoke');
            mkdirSync(outDir, { recursive: true });
            await page.screenshot({ path: join(outDir, 'floor-cleared.png'), fullPage: true });
        }

        /* GameScreen defers toast work while the floor overlay is open; continue must not unmount the rail. */
        await floorCleared.getByRole('button', { name: /^continue/i }).click();
        await expect(floorCleared).toBeHidden({ timeout: 15_000 });

        await expect(tipsRegion).toBeAttached();
        await expect(page.getByRole('heading', { name: /level \d+/i })).toBeAttached({ timeout: 15_000 });
    });
});
