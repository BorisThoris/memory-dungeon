import { expect, test } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSave, mainMenuPlayButton } from './visualScreenHelpers';

/**
 * How long the game takes to become usable.
 *
 * `gate:build-output` already budgets the renderer bundle's *size*, which is a proxy: a small
 * bundle that blocks on font decoding or a WebGL probe still leaves a player looking at nothing.
 * This measures the thing a player actually experiences — cold load to a menu they can press.
 *
 * The numbers are ceilings for a loaded CI machine, not targets. They are set well above what a
 * healthy build takes so that a failure means something broke, not that the runner was busy; a
 * regression that doubles startup will still trip them.
 *
 * What this is NOT: a shipping load time. Playwright drives the Vite dev server, so every module
 * is transformed on demand and the figure is several times what a packaged build does loading a
 * prebuilt bundle from disk. Treat it as a tripwire for "startup got much worse", never as a number
 * to quote about the game.
 */

/** Cold load to a main menu with an enabled Play button. */
const MENU_INTERACTIVE_BUDGET_MS = 20_000;
/** The Steam Deck's panel, which is the slowest hardware this is expected to ship on. */
const DECK_VIEWPORT = { height: 800, width: 1280 } as const;

test.describe('startup budget', () => {
    test.describe.configure({ retries: 0 });

    test('reaches a pressable main menu within the budget', async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize(DECK_VIEWPORT);

        const started = Date.now();
        await gotoWithSave(page, buildVisualSaveJson(true));
        const play = mainMenuPlayButton(page);
        await play.waitFor({ state: 'visible', timeout: MENU_INTERACTIVE_BUDGET_MS });
        await expect(play).toBeEnabled({ timeout: MENU_INTERACTIVE_BUDGET_MS });
        const elapsed = Date.now() - started;

        // Logged either way: the trend is more useful than the pass/fail on any one run.
        console.log(`STARTUP menu interactive in ${elapsed}ms (budget ${MENU_INTERACTIVE_BUDGET_MS}ms)`);
        expect(elapsed).toBeLessThan(MENU_INTERACTIVE_BUDGET_MS);
    });

    test('does not block the menu on anything that fails silently', async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize(DECK_VIEWPORT);

        // A console error during startup is how a missing asset or a failed probe shows up; the
        // menu can still appear while something needed later is already broken.
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(String(error)));

        await gotoWithSave(page, buildVisualSaveJson(true));
        await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: MENU_INTERACTIVE_BUDGET_MS });
        await page.waitForTimeout(1_500);

        expect(errors, `uncaught errors during startup:\n${errors.join('\n')}`).toEqual([]);
    });
});
