import { expect, test } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSave, mainMenuPlayButton } from './visualScreenHelpers';
import { flipTileAtGridCellKeyboard, waitForBoardPlayPhase } from './tileBoardGameFlow';
import { findUnreachableControls } from './uiReachability';
import { CHROME_ANCHORED_BOARD_OVERLAYS, expectBoardOverlaysClearChrome } from './boardOverlayClearance';

/**
 * The mode a player has to be able to reach and actually play.
 *
 * This project's most common defect by a distance is content that is implemented, documented and
 * unit-tested while nothing hands it to a player. Pass-and-play is a whole mode, so it gets the
 * whole path: found on Choose Your Path by name, started, played until the device changes hands,
 * and read back off the HUD.
 */

const openPassAndPlay = async (page: import('@playwright/test').Page, seats = 2): Promise<void> => {
    await gotoWithSave(page, buildVisualSaveJson(true));
    await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
    await mainMenuPlayButton(page).click();
    await page.waitForTimeout(900);
    /*
     * Filter rather than hunt. The browse grid is paged to fit without scrollbars, and at 390x844
     * that is one card per page out of thirteen — a spec that clicks the card by name works at
     * desktop and waits forever on a phone.
     */
    await page.getByRole('searchbox', { name: /filter modes/i }).fill('Pass and Play');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /pass and play/i }).first().click();
    // The card opens a detail sheet; its Play button is scoped to that dialog. An unscoped
    // `/^play/i` matches the Recommended run's "Start run" behind it and starts the wrong mode.
    const detail = page.getByRole('dialog', { name: /pass and play/i });
    await detail.waitFor({ state: 'visible', timeout: 20_000 });
    // One action per seat count: the table says how many are playing in a single press.
    await detail.getByRole('button', { name: new RegExp(`^${seats} players$`, 'i') }).click();
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

    test('a table of three gets three seats, not the two the catalog used to hardcode', async ({ page }) => {
        test.setTimeout(300_000);
        await page.setViewportSize({ width: 1280, height: 800 });
        await openPassAndPlay(page, 3);

        // The rules always allowed up to four. Only two were reachable, which is this project's
        // most common defect wearing a different hat.
        await expect(page.getByTestId('hud-seat-seat-3')).toBeVisible();
        await expect(page.getByTestId('hud-seat-seat-4')).toHaveCount(0);
        expect(await findUnreachableControls(page), 'three-seat board').toEqual([]);
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
         * Force a miss rather than hope for one. Tile ids are `${pairKey}-A|B`, so two tiles from
         * different pairs cannot match — and the dev hook picks by grid cell, which is how the rest
         * of this suite drives a WebGL board that has no element per tile.
         *
         * The first version of this clicked blind points and waited for a mismatch to happen. It
         * passed three times and then found the floor's exit instead, which opened a dialog over
         * the board and failed on an assertion about seats. A test that depends on the board not
         * going well is a test that reports something other than what it is named for.
         */
        const cells: [number, number][] = [];
        for (let row = 0; row < 4; row += 1) {
            for (let column = 0; column < 4; column += 1) {
                cells.push([row, column]);
            }
        }
        const idAt = (row: number, column: number) =>
            page.evaluate(
                ([r, c]) => {
                    const w = window as Window & { __e2eGetTileIdAtGrid1?: (row: number, col: number) => string | null };
                    return w.__e2eGetTileIdAtGrid1?.(r, c) ?? null;
                },
                [row, column] as const
            );
        const pairOf = (tileId: string): string => tileId.replace(/-[AB]$/u, '');

        /*
         * Only ordinary pair tiles, whose ids end in -A or -B. Floor one also carries dungeon
         * furniture — the exit among it — and picking one of those reveals the exit and opens a
         * dialog over the board instead of resolving a turn, which is how the first deliberate
         * miss here still failed.
         */
        const seen: { cell: [number, number]; pair: string }[] = [];
        for (const cell of cells) {
            const tileId = await idAt(...cell);
            if (tileId && /-[AB]$/u.test(tileId)) {
                seen.push({ cell, pair: pairOf(tileId) });
            }
        }
        const first = seen[0];
        const other = seen.find((row) => first && row.pair !== first.pair);
        expect(first, 'the board has tiles to pick').toBeDefined();
        expect(other, 'the board has two different pairs, so a miss is possible').toBeDefined();

        await flipTileAtGridCellKeyboard(page, first?.cell[0] ?? 0, first?.cell[1] ?? 0);
        await page.waitForTimeout(400);
        // A floor objective can complete on a flip and put a route prompt over the board; staying
        // on the floor is the answer here, since the turn under test has not resolved yet.
        const exitPrompt = page.getByRole('dialog', { name: /unlocked exit|exit/i });
        if (await exitPrompt.isVisible().catch(() => false)) {
            await exitPrompt.getByRole('button', { name: /^stay$/i }).click();
            await page.waitForTimeout(300);
        }
        await flipTileAtGridCellKeyboard(page, other?.cell[0] ?? 0, other?.cell[1] ?? 1);
        await expect
            .poll(async () => (await readSeats())[1]?.active === true, { timeout: 20_000 })
            .toBe(true);
        const passed = true;

        expect(passed, 'a miss passes the turn to the second player').toBe(true);

        /*
         * The pass has to be visible to the person it is addressed to. They were not watching the
         * HUD — they were waiting — so a seat marker changing colour is not a signal that reaches
         * them. The rules tracked this beat before anything drew it, which is exactly the shape of
         * defect this project keeps finding: a state nothing renders.
         */
        const banner = page.getByTestId('board-pass-handoff');
        await expect(banner, 'the board says who the device went to').toBeVisible();
        await expect(banner).toContainText(/pass to player 2/i);

        /*
         * And it sits where it says it does. This overlay offsets itself by the clearance the HUD
         * publishes, which was right until the stage was inset by that same clearance — after which
         * it counted twice and sat 144px into the board with nothing failing.
         */
        const placed = await expectBoardOverlaysClearChrome(page, CHROME_ANCHORED_BOARD_OVERLAYS, 'the pass');
        expect(
            placed.map((row) => row.testId),
            'the pass banner was measured, not skipped'
        ).toContain('board-pass-handoff');

        /*
         * And it is said, not only drawn. A player using a screen reader has no banner, and the
         * person the device is going to may not be looking at the screen at all — the whole reason
         * the beat exists is that they were waiting rather than watching.
         */
        await expect(page.getByTestId('hud-polite-live-region'), 'the pass is announced').toContainText(
            /player 2's turn/i,
            { timeout: 10_000 }
        );

        // And it clears when that player acts, rather than sitting over their board.
        await flipTileAtGridCellKeyboard(page, first?.cell[0] ?? 0, first?.cell[1] ?? 0);
        await page.waitForTimeout(600);
        await expect(banner, 'the pass clears once the next player acts').toBeHidden();
    });
});
