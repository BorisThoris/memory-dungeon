import { expect, test } from '@playwright/test';
import { buildPopulatedProfileSaveJson, buildVisualSaveJson, gotoWithSave, mainMenuPlayButton } from './visualScreenHelpers';
import { findUnreachableControls } from './uiReachability';

/**
 * The fast half of the fit contract: does a click reach the thing it lands on.
 *
 * The full sweep asks this too, on every screen at six sizes — and takes half an hour, so nobody
 * runs it, which is how a browse grid nothing could click shipped on the Steam Deck's own panel.
 * This one reaches its screens from the menu rather than by playing runs, at the two sizes that
 * actually caught something, so it can sit in the routine path and answer in a couple of minutes.
 */

// The two that found real bugs: the Deck's panel, and a phone held sideways.
const VIEWPORTS = [
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'landscape', width: 812, height: 375 }
] as const;

const MENU_SCREENS = [
    ['collection', /^collection$/i],
    ['profile', /^profile$/i],
    ['inventory', /^inventory$/i],
    ['codex', /^codex$/i],
    ['settings', /^settings$/i]
] as const;

test.describe('every control a screen shows can be clicked', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of VIEWPORTS) {
        test(`the menu and its screens at ${viewport.id}`, async ({ page }) => {
            test.setTimeout(240_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });

            // Profile is checked against a save with a full run history: it is the version of that
            // screen that can fail, and an empty one only proves the empty state is reachable.
            for (const [label, button] of MENU_SCREENS) {
                const save = label === 'profile' ? buildPopulatedProfileSaveJson(true) : buildVisualSaveJson(true);
                await gotoWithSave(page, save);
                await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
                expect(await findUnreachableControls(page), `main menu @ ${viewport.id}`).toEqual([]);

                await page.getByRole('button', { name: button }).click();
                await page.waitForTimeout(600);
                expect(await findUnreachableControls(page), `${label} @ ${viewport.id}`).toEqual([]);
            }
        });

        test(`choose your path at ${viewport.id}`, async ({ page }) => {
            test.setTimeout(180_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await gotoWithSave(page, buildVisualSaveJson(true));
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            await mainMenuPlayButton(page).click();
            await page.waitForTimeout(900);

            // The browse grid is the one that shipped broken: cards under the pager, on the panel
            // the release checklist names by name.
            expect(await findUnreachableControls(page), `choose your path @ ${viewport.id}`).toEqual([]);
        });
    }
});
