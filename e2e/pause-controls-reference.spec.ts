import { expect, test } from '@playwright/test';
import { expectGameplayReady, openPlayablePathFixture } from './playablePathHelpers';

/**
 * Finding out what the controls are, without already knowing.
 *
 * The shortcuts overlay opened on F1 or `?` and nowhere else, which asks a player to know the
 * shortcut for finding out the shortcuts — and a controller has neither key. Pause is where you
 * look, and it is reachable from the dock and from Start.
 */

test.describe('Controls from the pause menu', () => {
    test.describe.configure({ retries: 0 });

    test('opens the shortcuts reference, and closing it comes back to pause', async ({ page }) => {
        test.setTimeout(120_000);
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        await page.getByTestId('game-toolbar-main-menu').click({ force: true });
        const pause = page.getByTestId('game-pause-overlay');
        await expect(pause).toBeVisible();

        await pause.getByRole('button', { name: /^controls$/i }).click();

        const shortcuts = page.getByTestId('game-shortcuts-help-overlay');
        await expect(shortcuts).toBeVisible();
        // One modal at a time: pause steps aside rather than stacking behind it.
        await expect(pause).toHaveCount(0);
        await expect(shortcuts.getByRole('list')).toBeVisible();

        await shortcuts.getByRole('button', { name: /^close$/i }).click();
        await expect(shortcuts).toHaveCount(0);
        await expect(pause).toBeVisible();
    });
});
