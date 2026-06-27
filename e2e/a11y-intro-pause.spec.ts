import { expect, test, type Page } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import {
    buildVisualSaveJson,
    gotoWithSaveExpectStartupIntroVisible,
    openChooseYourPath,
    openLevel1Play,
    waitLevel1PlayReady
} from './visualScreenHelpers';

/** E2E-002 — `data-e2e-menu-pointer` must be interactive before menu clicks (see `startupIntroHelpers`). */
const menuPointerRoot = (page: Page) => page.getByTestId('main-menu-focus-root');

function pauseOverlay(page: Page) {
    return page.getByTestId('game-pause-overlay');
}

/** Initial focus is moved on rAF inside `OverlayModal`; wait via a11y tree, not `innerText` (can be empty under styles). */
async function expectPauseModalFocusOn(page: Page, name: RegExp): Promise<void> {
    const btn = pauseOverlay(page).getByRole('button', { name });
    await expect(btn).toBeFocused({ timeout: 8000 });
}

test.describe('E2E-002 / E2E-003 — startup intro + pause modal a11y', () => {
    test.describe.configure({ retries: 1 });

    test('E2E-002: after startup intro dismiss, menu pointer is interactive and primary Play click works', async ({
        page
    }) => {
        test.setTimeout(90_000);
        await gotoWithSaveExpectStartupIntroVisible(page, buildVisualSaveJson(true));
        await dismissStartupIntro(page);

        const root = menuPointerRoot(page);
        await expect(root).toHaveAttribute('data-e2e-menu-pointer', 'interactive');
        await openChooseYourPath(page);
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    });

    test('E2E-002: dismissStartupIntro is idempotent once the menu is interactive', async ({ page }) => {
        test.setTimeout(90_000);
        await gotoWithSaveExpectStartupIntroVisible(page, buildVisualSaveJson(true));
        await dismissStartupIntro(page);
        await expect(menuPointerRoot(page)).toHaveAttribute('data-e2e-menu-pointer', 'interactive');
        await dismissStartupIntro(page);
        await expect(menuPointerRoot(page)).toHaveAttribute('data-e2e-menu-pointer', 'interactive');
        await openChooseYourPath(page);
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    });

    test('E2E-003: pause modal receives focus and Tab cycles inside the dialog', async ({ page }) => {
        test.setTimeout(120_000);
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);

        await page.keyboard.press('p');
        const pause = page.getByTestId('game-pause-overlay');
        await expect(pause).toBeVisible();

        await expectPauseModalFocusOn(page, /^resume$/i);

        await page.keyboard.press('Tab');
        await expectPauseModalFocusOn(page, /^retreat$/i);

        await page.keyboard.press('Tab');
        await expectPauseModalFocusOn(page, /^resume$/i);

        await page.keyboard.press('Shift+Tab');
        await expectPauseModalFocusOn(page, /^retreat$/i);

        await pause.getByRole('button', { name: /^resume$/i }).click();
        await expect(pause).toBeHidden();
        await expect(page.getByTestId('game-hud')).toBeVisible();
    });
});
