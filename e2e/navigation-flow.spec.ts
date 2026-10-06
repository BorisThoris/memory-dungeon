import { openRunMenuItem } from './playablePathHelpers';
import { expect, test, type Page } from '@playwright/test';
import {
    openChooseYourPath,
    openMainMenuFromSave,
    openLevel1Play,
    waitLevel1PlayReady
} from './visualScreenHelpers';

/** The in-run shell is one bar: stats group, feedback line, action dock. */
async function expectGameplayHudWithWings(page: Page): Promise<void> {
    await expect(page.getByTestId('game-hud')).toBeVisible();
    await expect(page.getByTestId('hud-score')).toBeVisible();
    await expect(page.getByTestId('game-action-dock')).toBeVisible();
}

test.describe('Navigation shells', () => {
    test.describe.configure({ retries: 1 });
    test.setTimeout(120_000);
    test('Play opens Choose Your Path before level 1', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: 'Play', exact: true }).click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
        await page.getByRole('button', { name: 'Start run', exact: true }).click();
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole('region', { name: /choose your path/i })).toHaveCount(0);
    });

    test('optional setup applies a custom solo run', async ({ page }) => {
        test.setTimeout(120_000);
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await page.getByRole('button', { name: 'Set up your run', exact: true }).click();
        await page.getByText('Calm: slower resolves', { exact: true }).click();
        await expect(page.getByLabel('Calm: slower resolves')).toBeChecked();
        await page.getByTestId('classic-setup-sheet').getByRole('button', { name: 'Start run', exact: true }).click();
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 60_000 });
        const pacing = await page.evaluate(async () =>
            (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.resolveDelayMultiplier);
        expect(pacing).toBeGreaterThan(1);
    });

    test('Choose Your Path returns to the menu on Escape', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('region', { name: /choose your path/i })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    });

    test('Collection from main menu returns to menu on Back', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^collection$/i }).click();
        await expect(page.getByRole('region', { name: /collection/i })).toBeVisible();
        await expect(page.getByTestId('collection-entries')).toBeVisible();
        await page.getByRole('button', { name: /^back$/i }).click();
        await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible();
    });

    test('Codex from main menu returns to menu on Back', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^codex$/i }).click();
        await expect(page.getByRole('region', { name: /^codex$/i })).toBeVisible();
        await page.getByRole('button', { name: /^back$/i }).click();
        await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible();
    });

    test('In-run toolbar opens Inventory and Codex then returns to playing', async ({ page }) => {
        test.setTimeout(120_000);
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);
        await openRunMenuItem(page, 'inventory');
        await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible();
        await page
            .getByRole('region', { name: /inventory/i })
            .getByRole('button', { name: /^back$/i })
            .evaluate((el) => (el as HTMLButtonElement).click());
        await expectGameplayHudWithWings(page);

        await openRunMenuItem(page, 'codex');
        await expect(page.getByRole('region', { name: /codex/i })).toBeVisible();
        await page
            .getByRole('region', { name: /codex/i })
            .getByRole('button', { name: /^back$/i })
            .evaluate((el) => (el as HTMLButtonElement).click());
        await expectGameplayHudWithWings(page);
    });

    test('in-run inventory from toolbar keeps data-view=playing until Back (SIDE-013 shell parity)', async ({ page }) => {
        test.setTimeout(120_000);
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);
        const root = page.locator('[data-view]').first();
        await expect(root).toHaveAttribute('data-view', 'playing');
        await openRunMenuItem(page, 'inventory');
        await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible();
        await expect(root).toHaveAttribute('data-view', 'playing');
        await page
            .getByRole('region', { name: /inventory/i })
            .getByRole('button', { name: /^back$/i })
            .evaluate((el) => (el as HTMLButtonElement).click());
        await expect(root).toHaveAttribute('data-view', 'playing');
        await expectGameplayHudWithWings(page);
    });

    test('optional setup starts a shared-device run directly', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await page.getByRole('button', { name: /^Pass and Play\. Open details\.$/i }).click();
        await page.getByRole('button', { name: '3 players' }).click();
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 60_000 });
        const seats = await page.evaluate(async () =>
            (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.passAndPlay?.seats.length);
        expect(seats).toBe(3);
    });

});
