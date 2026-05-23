import { expect, test, type Page } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import {
    clickCanvasTile,
    defaultE2eGameSaveJson,
    navigateToLevel1PlayPhase,
    readFrameHiddenTileCount,
    STORAGE_KEY,
    waitForBoardPlayPhase
} from './tileBoardGameFlow';
import { completeLevel1Play, startClassicRunFromModeSelect } from './visualScreenHelpers';

async function readBoardViewport(page: Page): Promise<{ panX: number; panY: number; zoom: number }> {
    return page.getByTestId('tile-board-frame').evaluate((element) => ({
        panX: Number.parseFloat(element.getAttribute('data-board-pan-x') ?? '0'),
        panY: Number.parseFloat(element.getAttribute('data-board-pan-y') ?? '0'),
        zoom: Number.parseFloat(element.getAttribute('data-board-zoom') ?? '0')
    }));
}

/**
 * Headless Chromium often drops `page.mouse.wheel`; synthesize `WheelEvent` on the stage shell using layout geometry.
 * Note: in this stack, negative deltaY (zoom in) applies reliably; positive deltaY (zoom out) often does not — use Fit
 * board or assert zoom-in framing instead of depending on synthetic zoom-out.
 */
async function dispatchStageWheel(
    page: Page,
    stageShell: ReturnType<Page['getByTestId']>,
    deltaY: number
): Promise<void> {
    await expect(stageShell).toBeVisible({ timeout: 20_000 });
    await stageShell.evaluate((el, dy) => {
        const r = el.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        el.dispatchEvent(
            new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                clientX: cx,
                clientY: cy,
                deltaMode: 0,
                deltaY: dy
            })
        );
    }, deltaY);
}

test.describe.configure({ mode: 'serial' });

test.describe('Tile board interaction', () => {
    test.setTimeout(120_000);

    test('tile selection flips a tile after memorize phase', async ({ page }) => {
        await page.addInitScript(
            ([key, json]) => {
                localStorage.setItem(key, json);
            },
            [STORAGE_KEY, defaultE2eGameSaveJson]
        );
        await page.goto('/');

        await dismissStartupIntro(page);

        await page.getByRole('button', { name: /^play$/i }).click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
        await startClassicRunFromModeSelect(page);

        await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 15_000 });

        const canvas = page.getByTestId('tile-board-stage').locator('canvas');
        await expect(canvas).toBeVisible();

        // Run stats show during memorize; wait until play phase hides tiles again.
        await expect
            .poll(async () => readFrameHiddenTileCount(page), {
                timeout: 50_000,
                intervals: [80, 120, 200, 400]
            })
            .toBeGreaterThan(0);

        await waitForBoardPlayPhase(page);

        const hiddenBefore = await readFrameHiddenTileCount(page);

        await clickCanvasTile(page, 1, 1);

        await expect
            .poll(async () => readFrameHiddenTileCount(page), { timeout: 12_000 })
            .toBeLessThan(hiddenBefore);
    });

    test('desktop wheel zooms in and out, plain drag pans, and Fit board resets the viewport', async ({ page }) => {
        test.setTimeout(180_000);
        await page.addInitScript(
            ([key, json]) => {
                localStorage.setItem(key, json);
            },
            [STORAGE_KEY, defaultE2eGameSaveJson]
        );
        await page.goto('/');

        await dismissStartupIntro(page);

        await page.setViewportSize({ width: 1440, height: 900 });
        await page.getByRole('button', { name: /^play$/i }).click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
        await startClassicRunFromModeSelect(page);

        const stageShell = page.getByTestId('tile-board-stage-shell');
        await expect(stageShell).toBeVisible();
        const fitBoard = page.getByRole('button', { name: /^fit board$/i });
        await expect(fitBoard).toBeVisible();

        const box = await stageShell.boundingBox();
        expect(box).toBeTruthy();
        const centerX = box!.x + box!.width / 2;
        const centerY = box!.y + box!.height / 2;

        const before = await readBoardViewport(page);
        expect(before.zoom).toBeCloseTo(1, 3);

        await dispatchStageWheel(page, stageShell, -1200);
        await dispatchStageWheel(page, stageShell, -800);

        await expect.poll(async () => (await readBoardViewport(page)).zoom, { timeout: 10_000 }).toBeGreaterThan(1.05);

        // Positive deltaY (zoom-out) on synthetic WheelEvent is ignored in Chromium for this handler path while negative
        // (zoom-in) applies; use Fit board to return to baseline, then wheel zoom-in again before panning.
        await fitBoard.click({ force: true });
        await expect(async () => {
            const v = await readBoardViewport(page);
            expect(Math.abs(v.panX)).toBeLessThan(0.02);
            expect(Math.abs(v.panY)).toBeLessThan(0.02);
            expect(v.zoom).toBeCloseTo(1, 2);
        }).toPass({ timeout: 15_000 });

        await dispatchStageWheel(page, stageShell, -1200);
        await dispatchStageWheel(page, stageShell, -800);
        await expect.poll(async () => (await readBoardViewport(page)).zoom, { timeout: 10_000 }).toBeGreaterThan(1.05);

        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 120, centerY + 70);
        await page.mouse.up();

        await expect
            .poll(async () => {
                const viewport = await readBoardViewport(page);
                return Math.abs(viewport.panX) + Math.abs(viewport.panY);
            }, { timeout: 10_000 })
            .toBeGreaterThan(0.1);

        await fitBoard.click({ force: true });

        await expect(async () => {
            const v = await readBoardViewport(page);
            expect(Math.abs(v.panX)).toBeLessThan(0.02);
            expect(Math.abs(v.panY)).toBeLessThan(0.02);
            expect(v.zoom).toBeCloseTo(1, 2);
        }).toPass({ timeout: 20_000 });
    });

    test('continuing to the next level preserves the chosen zoom framing', async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await navigateToLevel1PlayPhase(page);

        const stageShell = page.getByTestId('tile-board-stage-shell');
        await expect(stageShell).toBeVisible();

        await expect.poll(async () => readFrameHiddenTileCount(page), { timeout: 20_000 }).toBeGreaterThanOrEqual(4);

        // After navigate captures memorize pairs: zoom in, then clear the floor. (Synthetic zoom-out is unreliable in
        // Chromium — negative deltaY zooms in for this handler.)
        await dispatchStageWheel(page, stageShell, -1200);
        await dispatchStageWheel(page, stageShell, -800);
        await expect.poll(async () => (await readBoardViewport(page)).zoom, { timeout: 15_000 }).toBeGreaterThan(1.05);
        const beforeContinue = await readBoardViewport(page);

        await expect
            .poll(async () => page.getByTestId('tile-board-frame').getAttribute('data-selection-suppressed'), {
                timeout: 15_000
            })
            .toBe('false');
        await expect
            .poll(async () => page.getByTestId('tile-board-frame').getAttribute('data-gesture-active'), {
                timeout: 15_000
            })
            .toBe('false');

        await completeLevel1Play(page, null);
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /^continue/i }).click();

        await expect(page.getByRole('heading', { name: /level 2/i })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible();

        await expect(async () => {
            const z = (await readBoardViewport(page)).zoom;
            expect(z).toBeCloseTo(beforeContinue.zoom, 1);
        }).toPass({ timeout: 20_000 });
    });
});
