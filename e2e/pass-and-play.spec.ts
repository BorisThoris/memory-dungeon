import { expect, test } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSave, mainMenuPlayButton } from './visualScreenHelpers';
import { readFrameHiddenTileCount, waitForBoardPlayPhase } from './tileBoardGameFlow';
import { findUnreachableControls } from './uiReachability';

/**
 * The mode a player has to be able to reach and actually play.
 *
 * This project's most common defect by a distance is content that is implemented, documented and
 * unit-tested while nothing hands it to a player. Pass-and-play is a whole mode, so it gets the
 * whole path: found on Choose Your Path by name, started, played until the device changes hands,
 * and read back off the HUD.
 */

const openPassAndPlay = async (page: import('@playwright/test').Page): Promise<void> => {
    await gotoWithSave(page, buildVisualSaveJson(true));
    await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
    await mainMenuPlayButton(page).click();
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /pass and play/i }).first().click();
    // The card opens a detail sheet; its Play button is scoped to that dialog. An unscoped
    // `/^play/i` matches the Recommended run's "Start run" behind it and starts the wrong mode.
    const detail = page.getByRole('dialog', { name: /pass and play/i });
    await detail.waitFor({ state: 'visible', timeout: 20_000 });
    await detail.getByRole('button', { name: /^play$/i }).click();
    await page.getByTestId('run-shell').waitFor({ state: 'visible', timeout: 30_000 });
};

test.describe('pass and play', () => {
    test.describe.configure({ retries: 0 });

    test('a player can find it, start it, and see both seats', async ({ page }) => {
        test.setTimeout(300_000);
        await page.setViewportSize({ width: 1280, height: 800 });
        await openPassAndPlay(page);

        const seats = page.getByTestId('hud-pass-and-play');
        await expect(seats, 'the HUD names the players').toBeVisible();
        await expect(page.getByTestId('hud-seat-seat-1')).toBeVisible();
        await expect(page.getByTestId('hud-seat-seat-2')).toBeVisible();

        // Whose turn it is has to be readable, not merely stored.
        const active = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-testid^="hud-seat-"]'))
                .map((el) => [el.getAttribute('data-testid'), el.getAttribute('data-active')])
        );
        expect(active).toEqual([
            ['hud-seat-seat-1', 'true'],
            ['hud-seat-seat-2', 'false']
        ]);

        expect(await findUnreachableControls(page), 'pass and play board').toEqual([]);
    });

    test('a miss hands the device to the other player', async ({ page }) => {
        test.setTimeout(600_000);
        await page.setViewportSize({ width: 1280, height: 800 });
        await openPassAndPlay(page);
        await waitForBoardPlayPhase(page);

        const readSeats = () =>
            page.evaluate(() =>
                Array.from(document.querySelectorAll('[data-testid^="hud-seat-"]')).map((el) => ({
                    active: el.getAttribute('data-active') === 'true',
                    id: el.getAttribute('data-testid') ?? ''
                }))
            );

        expect((await readSeats())[0]?.active, 'the first player opens').toBe(true);

        /*
         * Turns are taken by clicking real points on the board: the tiles are WebGL, so there is no
         * element per tile. Keep taking turns until the device changes hands — which is the rule
         * under test, and the only thing this asserts about the board itself.
         */
        const frame = page.getByTestId('tile-board-frame');
        const box = await frame.boundingBox();
        expect(box, 'the board frame is on screen').not.toBeNull();
        const point = (xFraction: number, yFraction: number): [number, number] => [
            Math.round((box?.x ?? 0) + (box?.width ?? 0) * xFraction),
            Math.round((box?.y ?? 0) + (box?.height ?? 0) * yFraction)
        ];

        const spots: [number, number][] = [
            [0.2, 0.28], [0.5, 0.28], [0.8, 0.28],
            [0.2, 0.72], [0.5, 0.72], [0.8, 0.72],
            [0.35, 0.5], [0.65, 0.5]
        ];
        let passed = false;
        for (let round = 0; round < 4 && !passed; round += 1) {
            for (const spot of spots) {
                await page.mouse.click(...point(...spot));
                await page.waitForTimeout(420);
                const seats = await readSeats();
                if (seats[1]?.active === true) {
                    passed = true;
                    break;
                }
                if ((await readFrameHiddenTileCount(page)) === 0) {
                    break;
                }
            }
        }

        expect(passed, 'a miss passes the turn to the second player').toBe(true);
    });
});
