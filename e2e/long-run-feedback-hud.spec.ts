import { expect, test, type Page } from '@playwright/test';
import {
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow
} from './visualScreenHelpers';
import { expectGameplayReady, openPlayablePathFixture } from './playablePathHelpers';

const FEEDBACK_VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'phone', width: 390, height: 844 }
] as const;

test.describe('Long-run feedback HUD readability', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of FEEDBACK_VIEWPORTS) {
        test(`${viewport.name} shows cause strip and touch detail rows without viewport overflow`, async ({ page }) => {
            test.setTimeout(90_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);
            await openHudInfo(page);

            const causeStrip = page.getByTestId('hud-in-run-cause-strip');
            await expect(causeStrip).toBeVisible();
            await expect(causeStrip).toContainText('Pickups');
            await expect(causeStrip).toContainText('Hazards');
            await expectLocatorFullyInWindowViewport(page, causeStrip, 8);
            await expectNoHorizontalOverflow(page);
            await expectAppScrollportHasNoVerticalOverflow(page, 18);

            await openHudMore(page);
            const touchRows = page.getByTestId('hud-touch-detail-rows');
            await expect(touchRows).toBeVisible();
            await expect(touchRows).toContainText('Objective');
            await expect(touchRows).toContainText('Perfect Memory');
            await expectLocatorFullyInWindowViewport(page, touchRows, 8);
            await expect(page.getByTestId('hud-perfect-memory')).toContainText(/Eligible|Locked/);

            await expectNoHorizontalOverflow(page);
            await expectFeedbackHudTextBoxesStayCoherent(page);
        });
    }
});

async function openHudInfo(page: Page): Promise<void> {
    const summary = page.getByText(/^Info$/i);
    if ((await summary.count()) > 0) {
        await summary.first().click({ force: true });
    }
}

async function openHudMore(page: Page): Promise<void> {
    const summary = page.getByText(/^More$/i);
    if ((await summary.count()) > 0) {
        await summary.first().click({ force: true });
    }
}

async function expectFeedbackHudTextBoxesStayCoherent(page: Page): Promise<void> {
    const metrics = await page
        .locator('[data-testid^="hud-cause-row-"], [data-testid^="hud-touch-detail-"]')
        .evaluateAll((items) =>
            items.map((item) => {
                const box = item.getBoundingClientRect();
                return {
                    text: item.textContent ?? '',
                    width: box.width,
                    height: box.height,
                    scrollWidth: item.scrollWidth,
                    scrollHeight: item.scrollHeight
                };
            })
        );

    expect(metrics.length).toBeGreaterThan(0);
    for (const item of metrics) {
        expect(item.width, `${item.text} should keep a stable readable width`).toBeGreaterThan(32);
        expect(item.height, `${item.text} should keep a stable readable height`).toBeGreaterThan(20);
        expect(item.scrollHeight, `${item.text} should not vertically clip`).toBeLessThanOrEqual(item.height + 8);
    }
}
