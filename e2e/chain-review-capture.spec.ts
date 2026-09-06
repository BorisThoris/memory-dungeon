import { expect, test, type Page } from '@playwright/test';
import { openPlayablePathFixture } from './playablePathHelpers';
import { dismissStartupIntro } from './startupIntroHelpers';
import { readTileClientRectAtGrid, waitForBoardPlayPhase } from './tileBoardGameFlow';
import { buildVisualSaveJson, gotoWithSave, mainMenuPlayButton } from './visualScreenHelpers';

/*
 * Review captures for the cascade batch: the clumped board with a tile under the pointer (the
 * clump read's ring and chip), the floor-clear dialog on a phone, the relic draft on a laptop and
 * the setup sheet on a phone held sideways — the four surfaces the fit contract found something
 * on. Not a gate: the point is to look at the frames, which nothing else in the suite does.
 */
const OUT = process.env.CHAIN_REVIEW_OUT ?? 'test-results/chain-review';

const VIEWPORTS = [
    { id: 'desktop', width: 1440, height: 900 },
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'phone', width: 390, height: 844 }
] as const;

async function hoverTile(page: Page, row: number, col: number): Promise<void> {
    const rect = await readTileClientRectAtGrid(page, row, col);
    await page.mouse.move(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await page.waitForTimeout(900);
}

test.describe('chain review captures', () => {
    test.describe.configure({ retries: 0, timeout: 180_000 });

    for (const viewport of VIEWPORTS) {
        test(`the clumped board with the clump read at ${viewport.id}`, async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'cascadeClump');
            await waitForBoardPlayPhase(page);
            await hoverTile(page, 1, 1);
            await expect(page.getByTestId('board-stage')).toBeVisible();
            await page.screenshot({ path: `${OUT}/board-clump-read-${viewport.id}.png` });
        });
    }

    test('the floor-clear dialog on a phone', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'floorClearWithRouteChoices');
        await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/floor-clear-phone.png` });
    });

    test('the relic draft on a laptop', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await openPlayablePathFixture(page, 'relicDraft');
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/relic-draft-laptop.png` });
    });

    test('the setup sheet on a phone held sideways', async ({ page }) => {
        await page.setViewportSize({ width: 812, height: 375 });
        await gotoWithSave(page, buildVisualSaveJson(true));
        await dismissStartupIntro(page);
        await mainMenuPlayButton(page).click({ force: true });
        const launch = page.getByRole('region', { name: /recommended run/i });
        await expect(launch).toBeVisible({ timeout: 15_000 });
        await launch.getByRole('button', { name: /^set up your run$/i }).click({ force: true });
        await expect(page.getByRole('dialog', { name: /set up your run/i })).toBeVisible();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/setup-sheet-landscape.png` });
    });
});
