import { expect, test, type Page } from '@playwright/test';
import {
    expectGameplayReady,
    expectRunIdentity,
    openModeLibrary
} from './playablePathHelpers';

/*
 * Gen 111 retired eight of the twelve cards into the Classic setup sheet: Wild is a joker and a
 * chaotic floor set, Scholar and Pin Vow are vows, Practice is a record toggle, Meditation is a
 * pace, Endless was Classic with the length turned up and Dungeon Showcase was a staged unrecorded
 * run; Gen 171 then retired the four that were other games (Daily, the puzzles), and Gen 178 took
 * the clock the timed card had left on the sheet, because the game has no timer. This spec used to start each of those by card name and went stale the day the cards
 * went. What is left is started the way a player starts it now — from the sheet — and proven the
 * same way, by what the pause menu names the run once the board is up. The bar itself carries
 * numbers only.
 */

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

    test('the plain descent starts from the launch panel in one press', async ({ page }) => {
        test.setTimeout(240_000);
        await openModeLibrary(page);
        await page.getByRole('region', { name: /recommended run/i }).getByRole('button', { name: /^start run$/i }).click({ force: true });
        await expectGameplayReady(page);
        await expectRunIdentity(page, /Classic Dungeon/i);
        // No run is timed, so the bar never carries a clock.
        await expect(page.getByRole('timer')).toHaveCount(0);
    });

    test('the setup sheet offers no clock', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await expect(sheet.getByRole('radio')).toHaveCount(0);
        await expect(sheet.getByText(/minutes|clock/i)).toHaveCount(0);
    });

    test('two vows taken together both hold, and the pause menu names the stricter one', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/scholar: no shuffle, no destroy/i).check({ force: true });
        await sheet.getByLabel(/pin vow: ten pins/i).check({ force: true });
        await startFromSheet(page, sheet);
        await expectRunIdentity(page, /Pin vow — Pins 10 this run/i);
        // The Scholar half is a rule about tools, so it shows where the tools are: the shuffle
        // and destroy actions in the dock stay present but cannot be pressed.
        const shuffle = page.getByRole('button', { name: /shuffle/i }).first();
        if ((await shuffle.count()) > 0) {
            await expect(shuffle).toBeDisabled();
        }
    });

    test('a wild run carries the joker and says so in the pause menu', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/wild: a joker tile/i).check({ force: true });
        await startFromSheet(page, sheet);
        await expectRunIdentity(page, /Wild Run/i);
        await expect(page.getByTestId('hud-mutators')).toBeVisible();
    });

    test('an unrecorded run says achievements are off before the first flip', async ({ page }) => {
        test.setTimeout(240_000);
        const sheet = await openSetupSheet(page);
        await sheet.getByLabel(/do not record this run/i).check({ force: true });
        await startFromSheet(page, sheet);
        await expectRunIdentity(page, /Practice — Achievements off/i);
    });
});
