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
        await expect(page.getByTestId('floor-clear-result-stack')).toHaveAttribute('data-route-choice-required', 'false');
        await expect(page.getByTestId('floor-clear-score')).toBeVisible();
        await expect(page.getByTestId('floor-clear-stats')).toContainText(/Rating/);
        await expect(page.getByTestId('route-choice-panel')).toHaveCount(0);
        await expect(page.getByTestId('floor-clear-payoff-stack')).toHaveCount(0);
        await floorClear.getByRole('button', { name: /^continue$/i }).click({ force: true });
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
    });

    test('shop purchase path shows wallet/stock consequences before continuing', async ({ page }) => {
        await openPlayablePathFixture(page, 'floorClearWithShop');
        const floorClear = page.getByRole('dialog', { name: /floor cleared/i });

        await floorClear.getByRole('button', { name: /visit shop/i }).click();
        await expectShopDecisionUsable(page);
        await expect(page.getByTestId('shop-screen')).toHaveAttribute('data-shop-return-mode', 'summary');
        const purse = page.locator('[aria-label$="shop gold"]').first();
        const startingGold = parseShopGold(await purse.getAttribute('aria-label'));
        const firstAvailableOffer = page.locator('[role="listitem"][data-status="available"]').first();
        await expect(firstAvailableOffer).toBeVisible();
        const purchaseButton = firstAvailableOffer.locator('button').filter({ hasText: /^spend \d+g$/i }).first();
        const cost = parseShopGold(await purchaseButton.textContent());
        await purchaseButton.click();
        await expect(page.locator('[role="listitem"][data-status="claimed"]').first()).toContainText(/claimed/i);
        await expect.poll(async () => parseShopGold(await purse.getAttribute('aria-label'))).toBe(startingGold - cost);
        await page.getByTestId('shop-action-dock').getByRole('button', { name: /^back to floor summary$/i }).click();
        await expect(floorClear).toBeVisible();
    });

    test('shop blocked buy and reroll states are visible', async ({ page }) => {
        await openPlayablePathFixture(page, 'floorClearWithShopLowGold');
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();
        await expectShopDecisionUsable(page);
        await expect(page.getByRole('listitem').filter({ hasText: /not enough shop gold/i }).first()).toBeVisible();
        await expect(page.locator('button').filter({ hasText: /^spend \d+g$/i }).first()).toBeDisabled();

        await openPlayablePathFixture(page, 'floorClearWithShop');
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();
        await expectShopDecisionUsable(page);
        await page.getByTestId('shop-reroll-button').click();
        await expect(page.getByTestId('shop-screen')).toHaveAttribute('data-shop-rerolls', '1');
        await expect(page.getByTestId('shop-reroll-button')).toContainText(/stock rerolled/i);
        await expect(page.getByText(/one reroll per visit/i)).toBeVisible();
    });

    test('shop continue path advances from summary to the next playable floor', async ({ page }) => {
        await openPlayablePathFixture(page, 'floorClearWithShop');
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();
        await expectShopDecisionUsable(page);
        await page.getByTestId('shop-action-dock').getByRole('button', { name: /^continue$/i }).click();
        await expectGameplayReady(page);
        await expect(page.getByTestId('shop-screen')).toBeHidden();
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

function parseShopGold(value: string | null): number {
    const match = value?.match(/\d+/);
    if (!match) {
        throw new Error(`Could not parse shop gold from: ${value ?? '<null>'}`);
    }
    return Number(match[0]);
}

async function expectShopDecisionUsable(page: Page): Promise<void> {
    await expect(page.getByRole('dialog', { name: /vendor alcove/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('shop-screen')).toBeVisible();
    await expect(page.getByRole('list', { name: /vendor stock/i })).toBeVisible();
    await expect(page.getByTestId('shop-action-dock')).toBeVisible();
}

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

