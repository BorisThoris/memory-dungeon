import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { readFrameHiddenTileCount, waitForBoardPlayPhase } from './tileBoardGameFlow';

/**
 * Steam Deck Verified, criterion two: "The default controller configuration must provide users
 * with the ability to access all content."
 *
 * The pad does not have its own input path in this game. `gamepadNavigation.ts` drives the focus
 * ring spatially and synthesises the arrow keys and Enter that each screen already answers, which
 * is what gives the whole game controller support at once instead of one screen at a time. The
 * consequence is that the criterion reduces to a keyboard question - and the board is where that
 * question is hard, because the tiles are three.js meshes with no DOM node of their own. What the
 * board has instead is one `role="application"` container with `tabIndex={0}`, an arrow-key cursor
 * over the pickable tiles, and Enter to commit.
 *
 * Nothing proved that path ran. The e2e helper every other spec flips a tile with was called
 * `flipTileAtGridCellKeyboard` and does not use the keyboard: it calls a dev-only pick hook and
 * flips the tile directly, so every "keyboard" flip in this suite has been bypassing
 * `handleBoardApplicationKeyDown` since it was written. A helper named for the thing it skips is
 * worse than no helper, because it reads as coverage. It is `flipTileAtGridCellViaDevHook` now.
 *
 * This spec uses the keyboard. Tab to the board, arrow to move the cursor, Enter to flip - and the
 * hidden-tile count has to fall, because that is the only evidence that a press reached the game
 * rather than the focus ring.
 */

const localChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;
test.use(localChromium ? { launchOptions: { executablePath: localChromium } } : {});

/** The Deck's panel. Valve's font floor is specified at this size, so the check runs at it. */
const DECK_VIEWPORT = { width: 1280, height: 800 };

test.describe('Deck Verified: the default controller reaches the board', () => {
    test('flips a tile with the keys a pad sends, not a dev hook', async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize(DECK_VIEWPORT);
        await page.goto('/');
        await dismissStartupIntro(page);
        await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible();
        const dismiss = page.getByRole('button', { name: /^dismiss$/i });
        if (await dismiss.isVisible().catch(() => false)) {
            await dismiss.click();
        }
        await page.getByRole('button', { name: /^play$/i }).click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
        await page.locator('button', { hasText: /start run/i }).first().click();
        await waitForBoardPlayPhase(page);

        const boardApplication = page.getByTestId('tile-board-application');
        await expect(boardApplication).toBeVisible({ timeout: 30_000 });

        // The pad's focus driver lands on real focusable elements; this is the one the board owns.
        await boardApplication.focus();
        await expect
            .poll(async () => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null), {
                timeout: 10_000
            })
            .toBe('tile-board-application');

        const hiddenBefore = await readFrameHiddenTileCount(page);
        expect(hiddenBefore, 'a fresh floor has hidden tiles to flip').toBeGreaterThan(0);

        /*
         * Arrow first so the cursor is somewhere the board chose, then commit. A board that ignores
         * the arrow still has a focused tile from its own default, so the flip is what is being
         * measured here rather than the cursor's exact landing square.
         */
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');

        await expect
            .poll(async () => readFrameHiddenTileCount(page), { timeout: 20_000 })
            .toBeLessThan(hiddenBefore);
    });
});
