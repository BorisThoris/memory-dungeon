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

    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 800, height: 375 }]) {
        test(`floor clear shows the payout then offers the next arena at ${viewport.width}`, async ({ page }) => {
            await page.setViewportSize(viewport);
            await openPlayablePathFixture(page, 'floorClearWithRouteChoices');
            const floorClearBeat = page.getByTestId('floor-clear-beat');
            await expect(floorClearBeat).toBeVisible({ timeout: 10_000 });
            await expect(floorClearBeat).toHaveCSS('position', 'absolute');
            await expect(floorClearBeat).toHaveCSS('z-index', '6');
            await expect(page.getByTestId('floor-clear-title')).toContainText(/floor \d+ cleared/i);
            await expect(page.getByTestId('floor-clear-par')).toHaveCount(0);
            await expect(page.getByTestId('floor-clear-score')).toBeVisible();
            await expect(floorClearBeat.getByRole('button')).toHaveCount(0);
            await page.screenshot({ path: `output/playwright/floor-clear-${viewport.width}.png` });
            await expect(floorClearBeat).toBeHidden({ timeout: 15_000 });
            const travel = page.getByRole('dialog', { name: 'Where now?' });
            await expect(travel).toBeVisible({ timeout: 30_000 });
            await travel.getByRole('button', { name: /^Go to/ }).first().click();
            await expectHudFloor(page, 2, 30_000);
        });
    }

    test('game over actions restart and return to menu', async ({ page }) => {
        test.setTimeout(260_000);
        await forceGameOverViaE2eHook(page);
        // The end is a cut-scene first; the ledger is its last choice.
        await expect(page.getByTestId('run-end-cinematic-record')).toBeVisible({ timeout: 60_000 });
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 800, height: 375 }]) {
            await page.setViewportSize(viewport);
            await expect(page.getByTestId('run-end-cinematic-record')).toBeInViewport();
            await page.screenshot({ path: `output/playwright/result-choices-${viewport.width}.png` });
        }
        await page.getByTestId('run-end-cinematic-record').click();
        await expect(page.getByTestId('run-end-verdict')).toBeFocused();
        const details = page.getByTestId('game-over-run-details');
        await expect(details).not.toHaveAttribute('open');
        await expect(page.getByTestId('game-over-next-run-loop')).toBeHidden();
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 800, height: 375 }]) {
            await page.setViewportSize(viewport);
            const retry = page.getByRole('button', { name: /play again.*start a new run/i });
            await expect(retry).toHaveCount(1);
            await expect(retry).toBeInViewport();
            await page.screenshot({ path: `output/playwright/results-${viewport.width}.png` });
            await details.locator('summary').click();
            await expect(page.getByTestId('game-over-next-run-loop')).toBeVisible();
            await page.getByTestId('game-over-copy-result').scrollIntoViewIfNeeded();
            await expect(page.getByTestId('game-over-copy-result')).toBeInViewport();
            await page.screenshot({ path: `output/playwright/result-details-${viewport.width}.png` });
            await details.locator('summary').click();
            await retry.scrollIntoViewIfNeeded();
        }
        await details.locator('summary').click();
        await expect(page.getByTestId('game-over-next-run-loop')).toBeVisible();
        await expect(page.getByTestId('game-over-next-run-loop')).toContainText(/Chain target/i);
        await expect(page.getByTestId('game-over-next-run-loop')).toContainText(/Reach Clean|Reach Sharp|Reach Fever|Hold Fever/i);
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



