import { expect, type Page } from '@playwright/test';

export async function dismissStartupIntro(page: Page): Promise<void> {
    const intro = page.getByRole('dialog', { name: /startup relic intro/i });
    const playButton = page
        .getByRole('group', { name: /primary actions/i })
        .getByRole('button', { name: /^play$/i });
    const introVisible = await intro.isVisible().catch(() => false);

    if (introVisible) {
        // The intro can close on its own between the visibility check and the click. A dispatch
        // with no timeout then waits for a dialog that is never coming back and eats the whole
        // test budget; give it a beat and fall through to the poll below, which is the real check.
        // The fallback needs the same bound: `locator.evaluate` waits for its element with no
        // limit of its own, and a trace of the "main menu hang" showed it waiting 410 seconds on
        // a dialog that had already gone.
        await intro
            .dispatchEvent('click', undefined, { timeout: 5_000 })
            .catch(
                async () =>
                    await intro
                        .evaluate(
                            (el) => {
                                (el as HTMLElement).click();
                            },
                            undefined,
                            { timeout: 2_000 }
                        )
                        .catch(() => {})
            );
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
