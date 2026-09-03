import { expect, test, type Page } from '@playwright/test';
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

/** Hold a button for a few frames, then let go — one deliberate press, as a hand would make it. */
const pressPad = async (page: Page, button: number): Promise<void> => {
    await page.evaluate((code) => (window as PadWindow).__holdPad?.([code]), button);
    await page.waitForTimeout(120);
    await page.evaluate(() => (window as PadWindow).__holdPad?.([]));
    await page.waitForTimeout(120);
};

const DPAD_DOWN = 13;
const DPAD_UP = 12;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const BUTTON_A = 0;

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

        // Walk back up to Play and press A: the pad has to be able to start a run.
        for (let step = 0; step < 8; step += 1) {
            const label = await focusedLabel(page);
            if (/^play/i.test(label)) {
                break;
            }
            await pressPad(page, DPAD_UP);
        }
        expect(await focusedLabel(page)).toMatch(/^play/i);

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
});
