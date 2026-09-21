import { expect, test, type Locator, type Page } from '@playwright/test';
import { VIEW_STATES, type ViewState } from '../src/shared/contracts';
import { CONTROLLER_BACK_CONTRACT } from '../src/shared/controller-back-contract';
import { openPlayablePathFixture } from './playablePathHelpers';
import { readFrameHiddenTileCount } from './tileBoardGameFlow';
import {
    buildVisualSaveJson,
    gotoWithSave,
    mainMenuPlayButton,
    openLevel1Play,
    waitLevel1PlayReady
} from './visualScreenHelpers';

/**
 * Controller support, against real screens.
 *
 * Playwright cannot plug in a pad, so the hardware is the only thing faked: a stub
 * `navigator.getGamepads` reports whatever the test is "holding". Everything past that point is
 * the shipping code — real layout, real focus, real screens — which is what makes this worth
 * running: the unit tests prove the mapping and the geometry, and this proves the focus ring
 * actually walks a menu somebody built.
 */

interface PadWindow extends Window {
    __holdPad?: (buttons: number[]) => void;
}

const installFakePad = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
        let pressed: number[] = [];
        const snapshot = () => ({
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 17 }, (_unused, index) => ({ pressed: pressed.includes(index) })),
            connected: true,
            id: 'e2e standard pad',
            index: 0,
            mapping: 'standard',
            timestamp: 0
        });
        Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [snapshot()] });
        (window as PadWindow).__holdPad = (buttons: number[]) => {
            pressed = buttons;
        };
        window.addEventListener('load', () => window.dispatchEvent(new Event('gamepadconnected')));
    });
};

/**
 * Hold a button for a few frames, then let go — one deliberate press, as a hand would make it.
 *
 * The hold is timed INSIDE the page, in one round trip. Held across two `evaluate` calls it was
 * timed in Playwright round trips instead: under load a 120 ms "tap" became a ~700 ms hold, the
 * pad's auto-repeat fired (`GAMEPAD_REPEAT_DELAY_MS` 420, then every 130), and a single press
 * arrived as four. That is what made the board test fail here — the board consumed the first
 * arrow, ran out of grid, and handed the repeat back, which walked the ring out of the board
 * exactly as designed. A tap has to be a tap, or this suite measures the machine it runs on.
 */
const pressPad = async (page: Page, button: number): Promise<void> => {
    await page.evaluate(async (code) => {
        (window as PadWindow).__holdPad?.([code]);
        await new Promise((resolve) => setTimeout(resolve, 120));
        (window as PadWindow).__holdPad?.([]);
    }, button);
    await page.waitForTimeout(120);
};

const DPAD_DOWN = 13;
const DPAD_UP = 12;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const BUTTON_A = 0;
const BUTTON_B = 1;

const focusedLabel = (page: Page): Promise<string> =>
    page.evaluate(() => (document.activeElement?.textContent ?? '').trim().slice(0, 40));

test.describe('controller navigation', () => {
    test.describe.configure({ retries: 0 });

    test('a pad walks the main menu and opens what it lands on', async ({ page }) => {
        test.setTimeout(180_000);
        await installFakePad(page);
        await gotoWithSave(page, buildVisualSaveJson(true));
        await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });

        // Nothing is focused on arrival; the first push has to put the ring somewhere.
        await pressPad(page, DPAD_DOWN);
        const first = await focusedLabel(page);
        expect(first.length).toBeGreaterThan(0);

        // And the next pushes have to move it, or the ring is stuck and the pad is useless.
        const seen = new Set<string>([first]);
        for (let step = 0; step < 4; step += 1) {
            await pressPad(page, DPAD_DOWN);
            seen.add(await focusedLabel(page));
        }
        expect(seen.size).toBeGreaterThan(1);

        /*
         * Walk back up to Play and press A: the pad has to be able to start a run.
         *
         * Which element has focus is asked of the element, not of its text. This used to match
         * `/^play/i` against `document.activeElement.textContent`, and the menu's roman-numeral
         * eyebrow made that string `IPlayBegin the descent` — so the walk never recognised Play,
         * ran off the top of the menu, and failed on the skip link. A label is copy; identity is
         * the thing being asserted.
         */
        const play = mainMenuPlayButton(page);
        for (let step = 0; step < 10; step += 1) {
            if (await play.evaluate((node) => node === document.activeElement)) {
                break;
            }
            await pressPad(page, DPAD_UP);
        }
        await expect(play).toBeFocused();

        await pressPad(page, BUTTON_A);
        await expect(mainMenuPlayButton(page)).toBeHidden({ timeout: 20_000 });
    });

    test('the focus ring is visible while the pad is driving', async ({ page }) => {
        test.setTimeout(180_000);
        await installFakePad(page);
        await gotoWithSave(page, buildVisualSaveJson(true));
        await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });

        await pressPad(page, DPAD_DOWN);
        await expect(page.locator('html')).toHaveAttribute('data-gamepad-active', 'true');

        // A real key press hands the styling back, so the ring does not linger for a keyboard player.
        await page.keyboard.press('Tab');
        await expect(page.locator('html')).not.toHaveAttribute('data-gamepad-active', 'true');
    });

    test('a pad can play the board and then walk back out of it', async ({ page }) => {
        test.setTimeout(300_000);
        await installFakePad(page);
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);

        const board = page.getByTestId('tile-board-application');
        await board.focus();
        const hiddenBefore = await readFrameHiddenTileCount(page);

        // Directions belong to the board while it has somewhere to go, so the ring stays put. Which
        // way that is depends on where the first pickable tile sits, so ask all four.
        let consumedByBoard = false;
        for (const direction of [DPAD_DOWN, DPAD_UP, DPAD_LEFT, DPAD_RIGHT]) {
            await board.focus();
            await pressPad(page, direction);
            if (await board.evaluate((node) => node === document.activeElement)) {
                consumedByBoard = true;
                break;
            }
        }
        expect(consumedByBoard).toBe(true);

        await board.focus();

        // A flips the focused tile: this is the whole game, reachable on a pad.
        await pressPad(page, BUTTON_A);
        await page.waitForTimeout(600);
        expect(await readFrameHiddenTileCount(page)).toBeLessThan(hiddenBefore);

        // And the board is not a trap: pushed far enough, the ring leaves for the surrounding HUD.
        for (let step = 0; step < 12; step += 1) {
            await pressPad(page, DPAD_UP);
            if (!(await board.evaluate((node) => node === document.activeElement))) {
                break;
            }
        }
        await expect(board).not.toBeFocused();
    });

    /**
     * Valve's controller criterion: the DEFAULT configuration must reach all content. Not "a
     * remapping can" - the pad out of the box, on every screen a player can be standing on.
     *
     * "All content" is a census here, not a list. The table is keyed by `ViewState`, so the
     * compiler fails this file when a view is added and nobody says what back does on it. That
     * matters because the first version of this test WAS a list - five meta screens I picked by
     * hand - and the two views it happened to leave out, Choose Your Path and the run summary,
     * both turned out to swallow B as well (Gen 252). A hand-picked list finds what you already
     * suspected.
     *
     * Each row either arrives at the view, proves it is open, presses B and proves it closed to
     * the menu, or names itself exempt with the reason. Exempt is a claim about the design, so it
     * has to survive being read out loud.
     *
     * The ring is walked in both directions because it is spatial, not cyclic: d-pad down stops at
     * the bottom of the menu, so anything above where focus lands is reached by going up. That is
     * the default mapping doing its job - but a down-only walk reports Collection unreachable,
     * which is how this test was nearly written as a bug report.
     */
    interface BackCase {
        /** How a player gets here from a cold boot. */
        readonly arrive: (page: Page) => Promise<void>;
        /** What proves this view is on screen. */
        readonly onScreen: (page: Page) => Locator;
    }

    const walkToAndOpen =
        (name: string) =>
        async (page: Page): Promise<void> => {
            await gotoWithSave(page, buildVisualSaveJson(true));
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            const target = new RegExp(name, 'i');
            const walked: string[] = [];
            let landed = false;
            for (const direction of [DPAD_DOWN, DPAD_UP]) {
                for (let step = 0; step < 12 && !landed; step += 1) {
                    await pressPad(page, direction);
                    const label = await focusedLabel(page);
                    walked.push(label || '(nothing focused)');
                    landed = target.test(label);
                }
                if (landed) {
                    break;
                }
            }
            expect(landed, `the d-pad never reached ${name}; it walked: ${[...new Set(walked)].join(' > ')}`).toBe(true);
            await pressPad(page, BUTTON_A);
        };

    const metaScreen = (label: string): BackCase => ({
        arrive: walkToAndOpen(label),
        onScreen: (page) => page.locator(`[role="region"][aria-label="${label}"]`)
    });

    /*
     * Which views have a back path, and why the rest do not, is `CONTROLLER_BACK_CONTRACT` - the
     * same table the release checklist proves its `controller-support` row against. This spec only
     * says HOW to arrive at each one and what proves it is on screen. One list, read twice: the
     * checklist asks whether it is complete and says something, this asks whether the app agrees.
     */
    const ARRIVALS: Partial<Record<ViewState, BackCase>> = {
        collection: metaScreen('Collection'),
        profile: metaScreen('Profile'),
        inventory: metaScreen('Inventory'),
        codex: metaScreen('Codex'),
        settings: {
            arrive: walkToAndOpen('Settings'),
            // Settings is not a `MetaShell`, so it is found by its panel rather than a region label.
            onScreen: (page) => page.getByTestId('settings-shell-panel')
        },
        modeSelect: {
            arrive: async (page) => {
                await gotoWithSave(page, buildVisualSaveJson(true));
                await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
                await mainMenuPlayButton(page).click({ force: true });
            },
            onScreen: (page) => page.getByRole('region', { name: /choose your path/i })
        },
        gameOver: {
            arrive: async (page) => {
                await openPlayablePathFixture(page, 'gameOver');
            },
            onScreen: (page) => page.getByText(/Expedition Over/i).first()
        }
    };

    /**
     * Every view the contract says has a back path needs a way to get to it here.
     *
     * This is asserted at runtime rather than by the type, because `Partial<Record<...>>` cannot
     * demand it and nothing typechecked `e2e/` before Gen 253 anyway - deleting a row and running
     * `tsc` came back clean, which is how that was found. A view added to the contract with a real
     * leave and no arrival would otherwise be silently unexercised.
     */
    test('every view the contract says answers back is exercised here', () => {
        const owed = VIEW_STATES.filter((view) => CONTROLLER_BACK_CONTRACT[view].leavesTo !== null);
        expect([...owed].sort()).toEqual([...(Object.keys(ARRIVALS) as ViewState[])].sort());
    });

    for (const [view, entry] of Object.entries(ARRIVALS) as [ViewState, BackCase][]) {
        test(`a pad reaches ${view} and B comes back out`, async ({ page }) => {
            test.setTimeout(180_000);
            await installFakePad(page);
            await entry.arrive(page);
            await expect(entry.onScreen(page)).toBeVisible({ timeout: 20_000 });

            // B is the universal back on a Deck. Without it the screen is a room with no door.
            await pressPad(page, BUTTON_B);
            await expect(entry.onScreen(page)).toBeHidden({ timeout: 20_000 });
            await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 20_000 });
        });
    }

    /**
     * The same button, mid-run, has to land somewhere else: back on the board with the run intact,
     * not out at the main menu. `resolveSubscreenCloseTarget` decides that, and this is the only
     * thing that runs it with a real run underneath.
     */
    test('B leaves an in-run meta screen for the board, not the menu', async ({ page }) => {
        test.setTimeout(300_000);
        await installFakePad(page);
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);

        await page.keyboard.press('p');
        await page.getByRole('button', { name: /^Codex$/i }).click();
        const codex = page.locator('[role="region"][aria-label="Codex"]');
        await expect(codex).toBeVisible({ timeout: 20_000 });

        await pressPad(page, BUTTON_B);
        await expect(codex).toBeHidden({ timeout: 20_000 });
        await expect(page.getByTestId('tile-board-application')).toBeVisible({ timeout: 20_000 });
        // Out at the main menu would mean the run was thrown away on a back press.
        await expect(mainMenuPlayButton(page)).toBeHidden();
    });
});
