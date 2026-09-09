import { expect, test } from '@playwright/test';
import {
    expectGameplayReady,
    forceCurrentRunGameOverViaE2eHook,
    forceGameOverViaE2eHook,
    openPlayablePathFixture
} from './playablePathHelpers';
import {
    buildFreshProfileSaveJson,
    expectHudFloor,
    gotoWithSave,
    mainMenuPlayButton,
    startClassicRunFromModeSelect,
    waitLevel1PlayReady,
    completeLevel1Play
} from './visualScreenHelpers';
import { dismissStartupIntro } from './startupIntroHelpers';
import { STORAGE_KEY } from './tileBoardGameFlow';

test.describe('Expanded playable interludes and post-run loop', () => {
    test.describe.configure({ retries: 0, timeout: 150_000 });

    test('floor clear offers no route and goes straight on', async ({ page }) => {
        await openPlayablePathFixture(page, 'floorClearWithRouteChoices');

        // No door between floors (Gen 173) and no screen either (Gen 182): the beat shows the
        // result over the board, has nothing to press, and the run goes on by itself. The screen
        // opens already complete, so the beat is up at once and gone ~1.6s later.
        const floorClearBeat = page.getByTestId('floor-clear-beat');
        await expect(floorClearBeat).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('floor-clear-title')).toContainText(/floor \d+ cleared/i);
        await expect(page.getByTestId('floor-clear-par')).toContainText(/par \d+/i);
        await expect(page.getByTestId('floor-clear-score')).toBeVisible();
        await expect(floorClearBeat.getByRole('button')).toHaveCount(0);
        await expect(floorClearBeat).toBeHidden({ timeout: 15_000 });
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
        await expectHudFloor(page, 2, 30_000);
    });


    test('game over actions restart and return to menu', async ({ page }) => {
        test.setTimeout(260_000);
        await forceGameOverViaE2eHook(page);
        await expect(page.getByTestId('game-over-next-run-loop')).toBeVisible();
        await expect(page.getByTestId('game-over-next-run-loop')).toContainText(/Chain target/i);
        await expect(page.getByTestId('game-over-next-run-loop')).toContainText(/Start x3 loop|Push x6 reward|Break into x10|Hold x10 pressure/i);
        // The mode is named once now, in the hero eyebrow; the rail carries only what
        // changes the next run.
        await expect(page.getByTestId('game-over-mode-heading')).toContainText(/run complete/i);

        await page.getByRole('button', { name: /play again.*start a new run/i }).first().click();
        await expectGameplayReady(page);

        await forceCurrentRunGameOverViaE2eHook(page);
        await page.getByRole('button', { name: /return to the main menu|mobile return to the main menu/i }).first().click();
        await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 15_000 });
    });

    test('fresh profile reaches the first playable board and can clear the first floor', async ({ page }) => {
        test.setTimeout(280_000);
        await gotoWithSave(page, buildFreshProfileSaveJson());
        await dismissStartupIntro(page);
        await expect(mainMenuPlayButton(page)).toBeVisible();
        await expect(page.getByText(/How To Play/i).first()).toBeVisible();

        await mainMenuPlayButton(page).click({ force: true });
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
        await startClassicRunFromModeSelect(page);
        await expectGameplayReady(page);
        await expect(page.getByTestId('run-shell-line')).toBeVisible({ timeout: 30_000 });
        const pairs = await waitLevel1PlayReady(page);
        await completeLevel1Play(page, pairs);
        // The floor-clear beat advances on its own; the first clear is done once the HUD reads floor two.
        await expectHudFloor(page, 2, 30_000);
        await expect
            .poll(
                async () =>
                    page.evaluate((storageKey) => {
                        const raw = localStorage.getItem(storageKey);
                        return raw ? JSON.parse(raw).onboardingDismissed === true : false;
                    }, STORAGE_KEY),
                { timeout: 15_000 }
            )
            .toBe(true);
    });
});



