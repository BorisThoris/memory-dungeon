import { expect, test } from '@playwright/test';

/**
 * The renderer must reach the main menu with no uncaught error. `src/shared` carries import
 * cycles, so a new module imported early by `main.tsx` can change evaluation order and throw a
 * temporal-dead-zone error that leaves the page blank. Unit tests cannot see that; this can.
 */
test('renderer boots to the main menu without page errors', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /memory dungeon/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible({ timeout: 30_000 });
    expect(pageErrors, `renderer threw during boot: ${pageErrors.join(' | ')}`).toEqual([]);
});
