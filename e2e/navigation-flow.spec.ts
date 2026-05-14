import { expect, test, type Page } from '@playwright/test';
import {
    ensureModeLibraryVisible,
    openChooseYourPath,
    openMainMenuFromSave,
    openLevel1Play,
    startClassicRunFromModeSelect,
    waitLevel1PlayReady
} from './visualScreenHelpers';

/** HUD-018 / QA-003: `GameplayHudBar` exposes `game-hud` plus `hud-wing-left|center|right`. If the HUD splits, migrate these assertions + `mobile-layout.spec.ts` together. */
async function expectGameplayHudWithWings(page: Page): Promise<void> {
    await expect(page.getByTestId('game-hud')).toBeVisible();
    await expect(page.getByTestId('hud-wing-left')).toBeVisible();
    await expect(page.getByTestId('hud-wing-center')).toBeVisible();
    await expect(page.getByTestId('hud-wing-right')).toBeVisible();
}

test.describe('Navigation shells', () => {
    test.describe.configure({ retries: 1 });
    test.setTimeout(120_000);
    test('Play opens Choose Your Path then Classic Run starts level 1', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await startClassicRunFromModeSelect(page);
    });

    test('Endless Mode stays locked behind Browse modes', async ({ page }) => {
        test.setTimeout(60_000);
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await ensureModeLibraryVisible(page);
        await page.getByRole('button', { name: /endless mode/i }).click();
        await expect(page.getByTestId('library-mode-detail-modal').getByText(/locked intentionally/i)).toBeVisible();
    });

    test('Settings opened from Choose Your Path returns to Choose Your Path', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await page.getByTestId('choose-path-settings').click();
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
        if (process.env.REG044_CAPTURE === '1') {
            await page.screenshot({ path: '/opt/cursor/artifacts/reg-044-mode-settings-return.png', fullPage: true });
        }
        await page.getByRole('button', { name: /^back$/i }).click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    });

    test('Collection from main menu returns to menu on Back', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^collection$/i }).click();
        await expect(page.getByRole('region', { name: /collection/i })).toBeVisible();
        await expect(page.getByTestId('collection-meta-frame-achievements')).toBeVisible();
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
        await page.getByTestId('game-toolbar-inventory').evaluate((el) => (el as HTMLButtonElement).click());
        await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible();
        await page
            .getByRole('region', { name: /inventory/i })
            .getByRole('button', { name: /^back$/i })
            .evaluate((el) => (el as HTMLButtonElement).click());
        await expectGameplayHudWithWings(page);

        await page.getByTestId('game-toolbar-codex').evaluate((el) => (el as HTMLButtonElement).click());
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
        await page.getByTestId('game-toolbar-inventory').evaluate((el) => (el as HTMLButtonElement).click());
        await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible();
        await expect(root).toHaveAttribute('data-view', 'playing');
        await page
            .getByRole('region', { name: /inventory/i })
            .getByRole('button', { name: /^back$/i })
            .evaluate((el) => (el as HTMLButtonElement).click());
        await expect(root).toHaveAttribute('data-view', 'playing');
        await expectGameplayHudWithWings(page);
    });

    test('Daily Challenge from Choose Your Path starts a run', async ({ page }) => {
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);
        await ensureModeLibraryVisible(page);
        await page.getByRole('button', { name: /daily challenge/i }).click();
        await page.getByTestId('library-mode-detail-modal').getByRole('button', { name: /^play$/i }).click();
        await expect(page.getByRole('heading', { name: /level 1/i })).toBeAttached({ timeout: 15_000 });
        await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 15_000 });
    });

});
