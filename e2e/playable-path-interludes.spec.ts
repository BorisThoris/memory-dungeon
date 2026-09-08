import { expect, test, type Page } from '@playwright/test';
import {
    expectGameplayReady,
    forceCurrentRunGameOverViaE2eHook,
    forceGameOverViaE2eHook,
    openPlayablePathFixture,
    openRunMenuItem
} from './playablePathHelpers';
import {
    buildFreshProfileSaveJson,
    expectLocatorFullyInWindowViewport,
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

        const floorClear = page.getByRole('dialog', { name: /floor cleared/i });
        await expect(floorClear).toBeVisible();
        // No door between floors any more (Gen 173): the result and a Continue, nothing to pick.
        await expect(page.getByTestId('floor-clear-score')).toBeVisible();
        await expect(page.getByTestId('floor-clear-stats')).toContainText(/Rating/);
        await expect(page.getByTestId('route-choice-panel')).toHaveCount(0);
        await expect(page.getByTestId('floor-clear-payoff-stack')).toHaveCount(0);
        await floorClear.getByRole('button', { name: /^continue$/i }).click({ force: true });
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
    });

    test('relic draft fixture shows build choices and can pick into the next floor', async ({ page }) => {
        await openPlayablePathFixture(page, 'relicDraft');
        await expect(page.getByTestId('game-relic-offer-overlay')).toBeVisible();
        await expect(page.getByRole('group', { name: /relic choices/i })).toBeVisible();
        await expect(page.getByTestId('relic-offer-card')).toHaveCount(3);
        await expect(page.getByTestId('relic-offer-card').first()).toContainText(/common|uncommon|rare/i);
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('relic-offer-card').first(), 8);
        for (let pick = 0; pick < 3; pick += 1) {
            if (!(await page.getByTestId('game-relic-offer-overlay').isVisible().catch(() => false))) {
                break;
            }
            await page.getByRole('group', { name: /relic choices/i }).getByRole('button').first().click();
        }
        await expectGameplayReady(page);

        await openInventoryFromToolbar(page);
        await expect(page.getByTestId('inventory-run-line')).toContainText(/Floor \d+ · .* · Score/);
        await expect(page.getByTestId('inventory-meta-frame-relics')).toBeVisible();
        await expect(page.getByTestId('inventory-meta-frame-relics')).not.toContainText(/no relic/i);
        await page.getByRole('region', { name: /inventory/i }).getByRole('button', { name: /^back$/i }).click();
        await expectGameplayReady(page);

        await forceCurrentRunGameOverViaE2eHook(page);
        await expect(page.getByTestId('game-over-next-run-loop')).toBeVisible();
        await expect(page.getByTestId('game-over-next-run-loop').locator('[data-next-run-row="chain_target"]')).toContainText(
            /Chain target/i
        );
        await expect(page.getByTestId('game-over-relic-chip').first()).toBeVisible();
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
        await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible({ timeout: 30_000 });
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


async function openInventoryFromToolbar(page: Page): Promise<void> {
    await expect(async () => {
        const inventory = page.getByRole('region', { name: /inventory/i });
        if (await inventory.isVisible().catch(() => false)) {
            return;
        }
        await openRunMenuItem(page, 'inventory');
        await expect(inventory).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 20_000 });
}

