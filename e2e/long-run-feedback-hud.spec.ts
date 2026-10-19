import { expect, test, type Page } from '@playwright/test';
import {
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow
} from './visualScreenHelpers';
import { expectGameplayReady, openPlayablePathFixture } from './playablePathHelpers';

/**
 * Readability of the run HUD deep into a hazard-heavy run, at the two viewports where it is
 * tightest.
 *
 * This used to open an Info disclosure for a cause strip and a More disclosure for touch detail
 * rows and a secondary stat drawer. That HUD is gone: the rebuild replaced up to 28 stacked panels
 * with one bar, one dock and one line, and hazards are marked on the board rather than restated in
 * text beside it. Both disclosure helpers checked whether their summary existed before clicking,
 * so once the summaries went the spec stopped opening anything and timed out on the first
 * assertion instead of failing — which is why it read as slowness for so long.
 *
 * The question it was asking is still worth asking, so it is asked of the HUD that ships.
 */

const FEEDBACK_VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'phone', width: 390, height: 844 }
] as const;

test.describe('Long-run feedback HUD readability', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of FEEDBACK_VIEWPORTS) {
        test(`${viewport.name} keeps the run bar readable and bounded on a hazard run`, async ({ page }) => {
            test.setTimeout(150_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'cascadeClump');
            await expectGameplayReady(page);

            const hud = page.getByTestId('game-hud');
            await expect(hud).toBeVisible();
            await expectLocatorFullyInWindowViewport(page, hud, 8);

            // The bar is numbers only; the score is the one that is always there.
            await expect(page.getByTestId('hud-score')).toBeVisible();

            /*
             * The bar carries the floor, the lives and the score (and the Dread and the milestone
             * beside the floor); par, the realm and the mutators moved into the run-details
             * disclosure on 2026-10-06 (`RunShell`, "Slim gameplay HUD"). So the bar is checked for
             * what it shows, and par is checked where it lives: open the disclosure, read it, close it.
             */
            const stats = hud.getByRole('group', { name: /run stats/i });
            for (const testId of ['hud-floor', 'hud-score', 'hud-misses-left']) {
                await expect(stats.getByTestId(testId)).toBeVisible();
            }
            const details = hud.getByTestId('run-details');
            await details.locator('summary').click();
            await expect(details.getByTestId('hud-par')).toBeVisible();
            await expectLocatorFullyInWindowViewport(page, details.getByTestId('hud-par'), 8);
            await details.locator('summary').click();
            await expect(details.getByTestId('hud-par')).toBeHidden();

            await expectNoHorizontalOverflow(page);
            await expectAppScrollportHasNoVerticalOverflow(page, 18);
            await expectRunBarTextStaysCoherent(page);
        });
    }

    test('phone keeps the dock and the bar off each other at 390px', async ({ page }) => {
        test.setTimeout(150_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'cascadeClump');
        await expectGameplayReady(page);

        const hud = page.getByTestId('game-hud');
        const dock = page.getByTestId('game-action-dock');
        await expectLocatorFullyInWindowViewport(page, hud, 8);
        await expectLocatorFullyInWindowViewport(page, dock, 8);

        const hudBox = await hud.boundingBox();
        const dockBox = await dock.boundingBox();
        expect(hudBox).toBeTruthy();
        expect(dockBox).toBeTruthy();
        expect(dockBox!.y, 'the dock sits below the bar, never over it').toBeGreaterThan(hudBox!.y + hudBox!.height);

        await expectNoHorizontalOverflow(page);
    });
});

/** Every cell the bar draws keeps a readable box and does not clip its own text. */
async function expectRunBarTextStaysCoherent(page: Page): Promise<void> {
    const metrics = await page
        .locator('[data-testid="game-hud"] [data-testid^="hud-"]')
        .evaluateAll((items) =>
            // What the bar draws: a closed disclosure's readings have no box until it is opened, and
            // the personal-best mark is one glyph on a phone, read by its label rather than its width.
            // The polite live region is for screen readers (a 1px box on purpose), an aria-hidden cell
            // is decoration, and a cell with no text (a meter's track) has nothing to read.
            items
                .filter(
                    (item) =>
                        item.getClientRects().length > 0 &&
                        item.getAttribute('data-testid') !== 'hud-personal-best' &&
                        item.getAttribute('data-testid') !== 'hud-polite-live-region' &&
                        item.closest('[aria-hidden="true"]') === null &&
                        (item.textContent ?? '').trim() !== ''
                )
                .map((item) => {
                    const box = item.getBoundingClientRect();
                    // A cell can only clip what it hides: a note hung below it (the lives' earned miss,
                    // Dread's next tier) overflows on purpose and is painted in full.
                    const hides = getComputedStyle(item).overflowY !== 'visible';
                    return {
                        height: box.height,
                        scrollHeight: hides ? item.scrollHeight : box.height,
                        text: `${item.getAttribute('data-testid')} "${(item.textContent ?? '').trim()}"`,
                        width: box.width
                    };
                })
        );

    expect(metrics.length).toBeGreaterThan(0);
    for (const item of metrics) {
        // A phone's compact cells are a glyph and a number (the gold, ◆0): a readable box, not a collapsed one.
        expect(item.width, `${item.text} should keep a stable readable width`).toBeGreaterThan(14);
        expect(item.height, `${item.text} should keep a stable readable height`).toBeGreaterThan(16);
        expect(item.scrollHeight, `${item.text} should not vertically clip`).toBeLessThanOrEqual(item.height + 8);
    }
}
