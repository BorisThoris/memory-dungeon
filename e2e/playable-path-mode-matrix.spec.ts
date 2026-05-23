import { expect, test } from '@playwright/test';
import {
    expectGameplayReady,
    openModeDetail,
    openModeLibrary
} from './playablePathHelpers';

const directPlayModes = [
    { title: 'Daily Challenge', hudIdentity: /Daily challenge/i },
    { title: 'Dungeon Showcase', hudIdentity: /Dungeon Showcase/i },
    { title: 'Puzzle', hudIdentity: /Puzzle:\s*Starter/i },
    { title: 'Mirror Puzzle', hudIdentity: /Puzzle:\s*Mirror craft/i },
    { title: 'Glyph Cross', hudIdentity: /Puzzle:\s*Glyph Cross/i },
    { title: 'Wild Run', hudIdentity: /Wild Run/i },
    { title: 'Practice', hudIdentity: /Practice/i },
    { title: 'Scholar', hudIdentity: /Scholar Contract/i },
    { title: 'Pin vow', hudIdentity: /Pin vow/i }
] as const;

test.describe('Expanded Choose Your Path mode matrix', () => {
    test.describe.configure({ retries: 0 });

    for (const mode of directPlayModes) {
        test(`${mode.title} detail starts a playable run with a stable identity signal`, async ({ page }) => {
            test.setTimeout(240_000);
            await openModeLibrary(page);
            if (
                mode.title === 'Dungeon Showcase' &&
                (await page.getByRole('region', { name: /recommended run/i }).getByRole('heading', { name: /^Dungeon Showcase$/i }).isVisible().catch(() => false))
            ) {
                await page.getByRole('region', { name: /recommended run/i }).getByRole('button', { name: /^start run$/i }).click();
                await expectGameplayReady(page);
                await expect(page.getByTestId('hud-mode-identity')).toContainText(mode.hudIdentity);
                return;
            }
            const modal = await openModeDetail(page, mode.title);
            await expect(modal.getByTestId('choose-path-start-contract')).toContainText(/Start signal/i);
            await modal.getByRole('button', { name: /^play$/i }).click();
            await expectGameplayReady(page);
            await expect(page.getByTestId('hud-mode-identity')).toContainText(mode.hudIdentity);
        });
    }

    test('Gauntlet preset starts a timed playable run with a stable identity signal', async ({ page }) => {
        test.setTimeout(240_000);
        await openModeLibrary(page);
        const modal = await openModeDetail(page, 'Gauntlet');
        await expect(modal.getByTestId('choose-path-start-contract')).toContainText(/timer/i);
        await modal.getByRole('button', { name: /^5m$/i }).click();
        await expectGameplayReady(page);
        await expect(page.getByTestId('hud-mode-identity')).toContainText(/Gauntlet/i);
    });

    test('Meditation setup can start with an explicit mutator selection', async ({ page }) => {
        test.setTimeout(240_000);
        await openModeLibrary(page);
        const modal = await openModeDetail(page, 'Meditation');
        await expect(modal.getByTestId('choose-path-start-contract')).toContainText(/Meditation Run/i);
        await modal.getByRole('button', { name: /set up run/i }).click();
        const setup = page.getByRole('dialog', { name: /meditation setup/i });
        await expect(setup).toBeVisible();
        const firstCheckbox = setup.getByRole('checkbox').first();
        if ((await firstCheckbox.count()) > 0) {
            await firstCheckbox.check({ force: true });
        }
        await setup.getByRole('button', { name: /start with selection/i }).click();
        await expectGameplayReady(page);
        await expect(page.getByTestId('hud-mode-identity')).toContainText(/Meditation Run/i);
    });

    test('locked Endless mode explains the staged state without starting a run', async ({ page }) => {
        await openModeLibrary(page);
        const modal = await openModeDetail(page, 'Endless Mode');
        await expect(modal.getByTestId('choose-path-start-contract')).toContainText(/no run starts/i);
        await expect(modal).toContainText(/locked intentionally/i);
        await expect(modal.getByRole('button', { name: /^play$/i })).toHaveCount(0);
        await modal.getByRole('button', { name: /^close$/i }).click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    });
});
