import { expect, test } from '@playwright/test';
import {
    closeVisibleModalByButton,
    completeClassicLevelOne,
    expectGameplayReady,
    openModeLibrary,
    openPlayablePathFixture,
    startClassicFromMenu
} from './playablePathHelpers';
import {
    buildVisualSaveJson,
    gotoWithSave,
    mainMenuPlayButton,
    openLevel1Play,
    openMainMenuFromSave
} from './visualScreenHelpers';

test.describe('Expanded playable navigation contract', () => {
    test.describe.configure({ retries: 0 });

    test('menu meta pages and settings preserve expected Back targets', async ({ page }) => {
        test.setTimeout(150_000);
        await openMainMenuFromSave(page, true);

        await page.getByRole('button', { name: /^inventory$/i }).click();
        await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible();
        await expect(page.getByText(/No active expedition/i)).toBeVisible();
        await expect(page.getByTestId('inventory-meta-frame-empty')).toContainText(/start a run/i);
        await page.getByRole('region', { name: /inventory/i }).getByRole('button', { name: /^back$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible();

        await page.getByRole('button', { name: /^collection$/i }).click();
        await expect(page.getByRole('region', { name: /collection/i })).toBeVisible();
        await expect(page.getByTestId('collection-meta-frame-reward-signals')).toBeVisible();
        await expect(page.getByTestId('collection-meta-frame-reward-gallery')).toBeVisible();
        await page.getByRole('region', { name: /collection/i }).getByRole('button', { name: /^back$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible();

        await page.getByRole('button', { name: /^codex$/i }).click();
        await expect(page.getByRole('region', { name: /codex/i })).toBeVisible();
        await expect(page.getByTestId('codex-knowledge-base-summary')).toBeVisible();
        await expect(page.getByTestId('codex-reward-signal')).toBeVisible();
        await page.getByRole('region', { name: /codex/i }).getByRole('button', { name: /^back$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible();

        await page.getByRole('button', { name: /^settings$/i }).click();
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
        await expect(page.getByTestId('settings-shell-panel')).toBeVisible();
        await page.getByRole('button', { name: /^back$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible();

        await page.getByRole('button', { name: /^profile$/i }).click();
        await expect(page.getByRole('region', { name: /profile/i })).toBeVisible();
        await expect(page.getByTestId('profile-summary-grid')).toBeVisible();
        await expect(page.getByTestId('profile-trust-footer')).toBeVisible();
        await page.getByRole('region', { name: /profile/i }).getByRole('button', { name: /^settings$/i }).click();
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
        await page.getByRole('button', { name: /^back$/i }).click();
        await expect(page.getByRole('region', { name: /profile/i })).toBeVisible();
        await page.getByRole('region', { name: /profile/i }).getByRole('button', { name: /^back$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible();
    });

    test('Choose Your Path back, browse search, detail close, and locked detail all stay in the mode shell', async ({ page }) => {
        test.setTimeout(90_000);
        await openModeLibrary(page);

        await page.getByRole('button', { name: /search modes/i }).click();
        await page.getByLabel(/filter modes/i).fill('scholar');
        await expect(page.getByRole('button', { name: /^Scholar\. Open details\.$/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Wild Run\. Open details\.$/i })).toHaveCount(0);
        await page.getByLabel(/filter modes/i).fill('');
        await page.getByRole('button', { name: /close search/i }).click();
        await expect(page.getByLabel(/filter modes/i)).toBeHidden();

        await page.getByRole('button', { name: /^Endless Mode\. Open details\.$/i }).click({ force: true });
        const detail = page.getByTestId('library-mode-detail-modal');
        await expect(detail).toBeVisible();
        await expect(detail).toContainText(/locked intentionally/i);
        await detail.getByRole('button', { name: /^close$/i }).click();
        await expect(detail).toBeHidden();

        await page.getByTestId('choose-path-inline-back').click();
        await expect(mainMenuPlayButton(page)).toBeVisible();
    });

    test('in-run pause, shortcuts, settings, and abandon confirmation return to valid shells', async ({ page }) => {
        test.setTimeout(120_000);
        await openLevel1Play(page);
        await expectGameplayReady(page);

        await page.keyboard.press('F1');
        await expect(page.getByTestId('game-shortcuts-help-overlay')).toBeVisible();
        await closeVisibleModalByButton(page, /^close$/i);
        await expect(page.getByTestId('game-shortcuts-help-overlay')).toBeHidden();

        await page.keyboard.press('p');
        await expect(page.getByTestId('game-pause-overlay')).toBeVisible();
        await page.getByTestId('game-pause-overlay').getByRole('button', { name: /^resume$/i }).click();
        await expect(page.getByTestId('game-pause-overlay')).toBeHidden();
        await expectGameplayReady(page);

        await page.getByTestId('game-toolbar-settings').click({ force: true });
        await expect(page.getByRole('dialog', { name: /run settings/i })).toBeVisible();
        await page.getByRole('dialog', { name: /run settings/i }).getByRole('button', { name: /^back$/i }).click();
        await expectGameplayReady(page);

        await page.getByTestId('game-toolbar-main-menu').click({ force: true });
        await expect(page.getByRole('dialog', { name: /abandon run/i })).toBeVisible();
        await page.getByRole('dialog', { name: /abandon run/i }).getByRole('button', { name: /^cancel$/i }).click();
        await expectGameplayReady(page);
    });

    test('active-run meta screens expose current run value, not only empty states', async ({ page }) => {
        test.setTimeout(120_000);
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        await page.getByTestId('game-toolbar-inventory').click({ force: true });
        await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible();
        await expect(page.getByTestId('inventory-meta-frame-run')).toContainText(/Run snapshot/i);
        await expect(page.getByTestId('inventory-meta-frame-mutators')).toContainText(/Wide recall|mutator/i);
        await expect(page.getByTestId('inventory-charges-panel')).toContainText(/Guard tokens/);
        await page.getByRole('region', { name: /inventory/i }).getByRole('button', { name: /^back$/i }).click();
        await expectGameplayReady(page);

        await page.getByTestId('game-toolbar-codex').click({ force: true });
        await expect(page.getByRole('region', { name: /codex/i })).toBeVisible();
        await expect(page.getByTestId('codex-knowledge-base-summary')).toBeVisible();
        await expect(page.getByTestId('codex-reward-signal')).toContainText(/guide|codex|mechanics/i);
        await page.getByRole('region', { name: /codex/i }).getByRole('button', { name: /^back$/i }).click();
        await expectGameplayReady(page);

        await page.getByTestId('game-toolbar-settings').click({ force: true });
        await expect(page.getByRole('dialog', { name: /run settings/i })).toBeVisible();
        await expect(page.getByTestId('settings-shell-panel')).toBeVisible();
        await expect(page.getByTestId('settings-shell-footer')).toBeVisible();
        await page.getByRole('dialog', { name: /run settings/i }).getByRole('button', { name: /^back$/i }).click();
        await expectGameplayReady(page);
    });

    test('post-run Collection and Profile reflect the latest completed run', async ({ page }) => {
        await gotoWithSave(page, buildPostRunMetaSaveJson());
        await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: /^collection$/i }).click();
        await expect(page.getByRole('region', { name: /collection/i })).toBeVisible();
        await expect(page.getByTestId('collection-meta-frame-reward-signals')).toBeVisible();
        await expect(page.getByTestId('collection-meta-frame-reward-gallery')).toBeVisible();
        await expect(page.getByText(/Last run:/i)).toBeVisible();
        await page.getByRole('region', { name: /collection/i }).getByRole('button', { name: /^back$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible();

        await page.getByRole('button', { name: /^profile$/i }).click();
        await expect(page.getByRole('region', { name: /profile/i })).toBeVisible();
        await expect(page.getByTestId('profile-summary-grid')).toBeVisible();
        await expect(page.getByTestId('profile-recent-run')).toContainText(/Recent Descent/i);
        await expect(page.getByTestId('profile-recent-run')).not.toContainText(/No active record/i);
        await expect(page.getByTestId('profile-objective-board')).toBeVisible();
    });

    test('floor clear Main Menu action uses abandon confirmation before leaving gameplay', async ({ page }) => {
        test.setTimeout(260_000);
        await completeClassicLevelOne(page);
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /^main menu$/i }).click();
        await expect(page.getByRole('dialog', { name: /abandon run/i })).toBeVisible();
        await page.getByRole('dialog', { name: /abandon run/i }).getByRole('button', { name: /^abandon run$/i }).click();
        await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 15_000 });
    });

    test('classic run can still be started through the compact helper path', async ({ page }) => {
        test.setTimeout(120_000);
        await startClassicFromMenu(page);
    });
});

function buildPostRunMetaSaveJson(): string {
    const save = JSON.parse(buildVisualSaveJson(true)) as Record<string, unknown>;
    save.bestScore = 4242;
    save.lastRunSummary = {
        totalScore: 4242,
        bestScore: 4242,
        levelsCleared: 2,
        highestLevel: 3,
        achievementsEnabled: true,
        unlockedAchievements: [],
        bestStreak: 5,
        perfectClears: 1,
        runSeed: 72001,
        runRulesVersion: 1,
        gameMode: 'endless',
        activeMutators: ['wide_recall'],
        relicIds: ['extra_shuffle_charge']
    };
    return JSON.stringify(save);
}
