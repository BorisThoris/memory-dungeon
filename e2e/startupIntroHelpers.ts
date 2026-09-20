import { expect, type Page } from '@playwright/test';

export async function dismissStartupIntro(page: Page): Promise<void> {
    const intro = page.getByRole('dialog', { name: /startup relic intro/i });
    const playButton = page
        .getByRole('group', { name: /primary actions/i })
        .getByRole('button', { name: /^play$/i });
    const introVisible = await intro.isVisible().catch(() => false);

    if (introVisible) {
        // Use the shipped keyboard skip path; a synthetic click does not fire pointerdown.
        await intro.press('Escape', { timeout: 2_000 }).catch(() => {});
    }

    await expect
        .poll(
            async () => ({
                introVisible: await intro.isVisible().catch(() => false),
                playVisible: await playButton.isVisible().catch(() => false)
            }),
            { timeout: 30_000, intervals: [80, 150, 300, 500] }
        )
        .toEqual({
            introVisible: false,
            playVisible: true
        });

    // Main menu keeps `pointer-events: none` while the intro blur layer is applied; the a11y poll
    // above can pass before React removes that state, so Play clicks would be dropped (flaky under load).
    await expect(page.locator('[data-e2e-menu-pointer="interactive"]')).toBeAttached({ timeout: 25_000 });
}
