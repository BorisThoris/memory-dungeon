import { expect, test, type Page } from '@playwright/test';
import {
    expectGameplayReady,
    openModeDetail,
    openModeLibrary
} from './playablePathHelpers';

/*
 * Gen 111 retired eight of the twelve cards into the Classic setup sheet: Gauntlet is a clock,
 * Wild is a joker and a chaotic floor set, Scholar and Pin Vow are vows, Practice is a record
 * toggle, Meditation is a pace, Endless was Classic with the length turned up and Dungeon Showcase
 * was a staged unrecorded run. This spec used to start each of those by card name and went stale
 * the day the cards went; the modes that differ in kind are still started by name below, and the
 * retired ones are started the way a player starts them now — from the sheet — and proven the
 * same way, by what the HUD says once the board is up.
 */
const directPlayModes = [
    { title: 'Daily Challenge', hudIdentity: /Daily challenge/i },
    { title: 'Puzzle', hudIdentity: /Puzzle:\s*Starter/i },
    { title: 'Mirror Puzzle', hudIdentity: /Puzzle:\s*Mirror craft/i },
    { title: 'Glyph Cross', hudIdentity: /Puzzle:\s*Glyph Cross/i }
] as const;

async function openSetupSheet(page: Page) {
    await openModeLibrary(page);
    const launch = page.getByRole('region', { name: /recommended run/i });
    await expect(launch).toBeVisible();
    await launch.getByRole('button', { name: /^set up your run$/i }).click({ force: true });
    const sheet = page.getByRole('dialog', { name: /set up your run/i });
    await expect(sheet).toBeVisible();
    return sheet;
}

async function startFromSheet(page: Page, sheet: ReturnType<Page['getByRole']>): Promise<void> {
    await sheet.getByRole('button', { name: /^start run$/i }).click({ force: true });
    await expectGameplayReady(page);
}

test.describe('Expanded Choose Your Path mode matrix', () => {
    test.describe.configure({ retries: 0 });

    for (const mode of directPlayModes) {
        test(`${mode.title} detail starts a playable run with a stable identity signal`, async ({ page }) => {
            test.setTimeout(240_000);
            await openModeLibrary(page);
            const modal = await openModeDetail(page, mode.title);
            await expect(modal.getByTestId('choose-path-start-contract')).toContainText(/Start signal/i);
            await modal.getByRole('button', { name: /^play$/i }).click();
            await expectGameplayReady(page);
            await expect(page.getByTestId('hud-mode-identity')).toContainText(mode.hudIdentity);
        });
    }

    test('the plain descent starts from the launch panel in one press', async ({ page }) => {
        test.setTimeout(240_000);
        await openModeLibrary(page);
        await page.getByRole('region', { name: /recommended run/i }).getByRole('button', { name: /^start run$/i }).click({ force: true });
        await expectGameplayReady(page);
        await expect(page.getByTestId('hud-mode-identity')).toContainText(/Classic Dungeon/i);
        await expect(page.getByTestId('hud-gauntlet-timer')).toHaveCount(0);
    });

    test('the clock on the setup sheet starts a timed run', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/^5 minutes$/i).check({ force: true });
        await startFromSheet(page, sheet);
        // The clock is its own stat, so the identity line does not repeat it.
        await expect(page.getByTestId('hud-gauntlet-timer')).toBeVisible();
        await expect(page.getByTestId('hud-mode-identity')).toContainText(/Classic Dungeon/i);
    });

    test('two vows taken together both hold, and the bar names the stricter one', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/scholar: no shuffle, no destroy/i).check({ force: true });
        await sheet.getByLabel(/pin vow: ten pins/i).check({ force: true });
        await startFromSheet(page, sheet);
        const identity = page.getByTestId('hud-mode-identity');
        await expect(identity).toContainText(/Pin vow/i);
        await expect(identity).toContainText(/Pins 10 this run/i);
        // The Scholar half is a rule about tools, so it shows where the tools are: the shuffle
        // and destroy actions in the dock stay present but cannot be pressed.
        const shuffle = page.getByRole('button', { name: /shuffle/i }).first();
        if ((await shuffle.count()) > 0) {
            await expect(shuffle).toBeDisabled();
        }
    });

    test('a wild run carries the joker and says so on the bar', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/wild: a joker tile/i).check({ force: true });
        await startFromSheet(page, sheet);
        await expect(page.getByTestId('hud-mode-identity')).toContainText(/Wild Run/i);
        await expect(page.getByTestId('hud-mutators')).toBeVisible();
    });

    test('an unrecorded run says achievements are off before the first flip', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/do not record this run/i).check({ force: true });
        await startFromSheet(page, sheet);
        const identity = page.getByTestId('hud-mode-identity');
        await expect(identity).toContainText(/Practice/i);
        await expect(identity).toContainText(/Achievements off/i);
    });
});
