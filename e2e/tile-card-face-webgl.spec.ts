import { expect, test, type Page } from '@playwright/test';
import { countPngPixelDiffs } from './pngDiff';
import {
    defaultE2eGameSaveJson,
    navigateToLevel1PlayPhase,
    clickHiddenTileRowCol,
    readFrameHiddenTileCount,
    waitForBoardPlayPhase
} from './tileBoardGameFlow';
import { expectGameplayReady, openPlayablePathFixture } from './playablePathHelpers';

/** Locator screenshots wait for layout stability; GL + camera layout can stay “unstable” — clip from the live box instead. */
async function screenshotStageShellPng(page: Page, stageLocator: ReturnType<Page['getByTestId']>): Promise<Buffer> {
    const clip = await stageLocator.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    expect(clip.width, 'stage shell has layout width').toBeGreaterThan(2);
    expect(clip.height, 'stage shell has layout height').toBeGreaterThan(2);
    const vs = page.viewportSize()!;
    const x = Math.max(0, Math.floor(clip.x));
    const y = Math.max(0, Math.floor(clip.y));
    const width = Math.min(Math.ceil(clip.width), vs.width - x);
    const height = Math.min(Math.ceil(clip.height), vs.height - y);
    return await page.screenshot({
        type: 'png',
        clip: { x, y, width, height },
        animations: 'disabled',
        timeout: 35_000
    });
}

test.describe('Tile card face (WebGL)', () => {
    test('keeps the board mounted while WebGL context recovery is pending', async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1280, height: 720 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);
        await waitForBoardPlayPhase(page);

        const application = page.getByTestId('tile-board-application');
        const stageShell = page.getByTestId('tile-board-stage-shell');
        const canvasLocator = page.getByTestId('tile-board-stage').locator('canvas');
        await expect(canvasLocator).toBeVisible();

        await canvasLocator.evaluate((canvas) => {
            canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
        });

        await expect(page.getByTestId('tile-board-gpu-lost')).toBeVisible();
        await expect(application).toBeVisible();
        await expect(stageShell).toBeVisible();
        await expect(canvasLocator).toBeAttached();
    });

    test('canvas differs only slightly after one flip (split back/face bitmaps + text overlay)', async ({ page }, testInfo) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1280, height: 720 });
        await navigateToLevel1PlayPhase(page, defaultE2eGameSaveJson);

        const stageLocator = page.getByTestId('tile-board-stage-shell');
        const canvasLocator = page.getByTestId('tile-board-stage').locator('canvas');
        await expect(canvasLocator).toBeVisible();
        await expect(page.getByTestId('tile-board-application')).toBeVisible();
        /**
         * Stage shell can report a zero Playwright bounding box while absolutely positioned under the mobile camera
         * layout; wait on the GL canvas backing dimensions instead (R3F resize).
         */
        await expect
            .poll(
                async () =>
                    canvasLocator.evaluate((c) => {
                        const el = c as HTMLCanvasElement;
                        return el.width > 2 && el.height > 2;
                    }),
                { timeout: 25_000 }
            )
            .toBeTruthy();

        await page.waitForTimeout(400);
        const shotHidden = await screenshotStageShellPng(page, stageLocator);
        const hiddenCount = await readFrameHiddenTileCount(page);
        /** Flip via keyboard (focus + Enter); same as player path; avoids flaky canvas pointer synthesis in CI. */
        await clickHiddenTileRowCol(page, 1, 1, hiddenCount);

        await expect.poll(async () => readFrameHiddenTileCount(page), { timeout: 4000 }).toBeLessThan(hiddenCount);
        const exitPrompt = page.getByRole('dialog', { name: /unlocked exit/i });
        if (await exitPrompt.isVisible().catch(() => false)) {
            await exitPrompt.getByRole('button', { name: /^stay$/i }).click();
            await expect(exitPrompt).toBeHidden({ timeout: 10_000 });
        }
        /** The board can keep ambient GL motion; wait for the flip state to paint, then assert bounded stage diff. */
        await page.waitForTimeout(650);

        const shotFlipped = await screenshotStageShellPng(page, stageLocator);

        const { diffPixels, width, height } = countPngPixelDiffs(shotHidden, shotFlipped);
        const total = width * height;
        const ratio = diffPixels / total;

        await testInfo.attach('board-hidden.png', { body: shotHidden, contentType: 'image/png' });
        await testInfo.attach('board-one-flipped.png', { body: shotFlipped, contentType: 'image/png' });

        /**
         * QA-005 — Bounded pixel diff for whole stage screenshots (particles/bloom would require raising this or masking).
         * One flip swaps back vs face art + text overlay; GL filtering widens edge deltas vs DOM.
         */
        const maxDiffRatio = 0.16;
        expect(
            ratio,
            `Expected bounded board diff after one flip; diff ratio ${(ratio * 100).toFixed(2)}% with ${diffPixels} px`
        ).toBeLessThan(maxDiffRatio);
    });
});
