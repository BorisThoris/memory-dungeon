import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { defaultE2eGameSaveJson, STORAGE_KEY } from './tileBoardGameFlow';
import { startClassicRunFromModeSelect } from './visualScreenHelpers';

/**
 * Without WebGL the board cannot render; user sees the inline requirement message (DOM path only).
 */
test.use({
    launchOptions: {
        args: ['--disable-webgl', '--disable-webgl2']
    }
});

test.describe('Tile board without WebGL', () => {
    test('shows WebGL required instead of the canvas board', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
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

        await expect(page.getByTestId('tile-board-webgl-required')).toBeVisible({ timeout: 12_000 });
        await expect(page.getByTestId('tile-board-application')).toHaveCount(0);
    });
});
