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
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);

            const hud = page.getByTestId('game-hud');
            await expect(hud).toBeVisible();
            await expectLocatorFullyInWindowViewport(page, hud, 8);

            // The bar says which run this is before it says anything about numbers.
            await expect(page.getByTestId('hud-mode-identity')).toBeVisible();

            const stats = hud.getByRole('group', { name: /run stats/i });
            for (const testId of ['hud-floor', 'hud-lives', 'hud-score', 'hud-combo-shards']) {
                await expect(stats.getByTestId(testId)).toBeVisible();
            }

            await expectNoHorizontalOverflow(page);
            await expectAppScrollportHasNoVerticalOverflow(page, 18);
            await expectRunBarTextStaysCoherent(page);
        });
    }

    test('phone keeps the dock and the bar off each other at 390px', async ({ page }) => {
        test.setTimeout(150_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
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
            items.map((item) => {
                const box = item.getBoundingClientRect();
                return {
                    height: box.height,
                    scrollHeight: item.scrollHeight,
                    text: item.textContent ?? '',
                    width: box.width
                };
            })
        );

    expect(metrics.length).toBeGreaterThan(0);
    for (const item of metrics) {
        expect(item.width, `${item.text} should keep a stable readable width`).toBeGreaterThan(24);
        expect(item.height, `${item.text} should keep a stable readable height`).toBeGreaterThan(16);
        expect(item.scrollHeight, `${item.text} should not vertically clip`).toBeLessThanOrEqual(item.height + 8);
    }
}
