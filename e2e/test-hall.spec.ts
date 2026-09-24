import { expect, test, type Page } from '@playwright/test';
import { TEST_HALL_ROOMS } from '../src/shared/test-hall-rooms';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

/**
 * The test hall in a real browser (dev only, `/__hall` and `/?hallRoom=<id>`).
 *
 * The unit suite already plays every room's script through the rules. What only a browser can say
 * is that the hall page renders and its sweep agrees, and that every room actually boots into
 * play: the board on screen is the room's board, the badge names the room, and a first match
 * pressed through the store's own `pressTile` - the path a click takes - lands.
 */

const readRun = (page: Page) =>
    page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const { view, run } = useAppStore.getState();
        return {
            view,
            status: run?.status ?? null,
            tiles: run?.board?.tiles.length ?? 0,
            /* A match that clears the floor moves the run on and resets the board's count, so
               progress is floors first, then pairs. */
            progress: (run?.board?.level ?? 0) * 1000 + (run?.board?.matchedPairs ?? 0)
        };
    });

test.describe('Test hall', () => {
    test('the hall renders, its sweep passes and it lists graph coverage', async ({ page }) => {
        test.setTimeout(180_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));

        await page.goto('/__hall', { waitUntil: 'domcontentloaded', timeout: 180_000 });
        await expect(page.getByTestId('test-hall')).toBeVisible({ timeout: 60_000 });
        for (const hallRoom of TEST_HALL_ROOMS) {
            await expect(page.getByTestId(`test-hall-room-${hallRoom.id}`)).toBeVisible();
        }
        await page.getByTestId('test-hall-run-all').click();
        await expect(page.getByTestId('test-hall-summary')).toHaveText(`All ${TEST_HALL_ROOMS.length} rooms pass`);
        await expect(page.getByTestId('test-hall-coverage')).toContainText('Graph coverage');
        expect(errors).toEqual([]);
    });

    for (const hallRoom of TEST_HALL_ROOMS) {
        test(`room "${hallRoom.id}" boots into play`, async ({ page }) => {
            test.setTimeout(180_000);
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));

            await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), `hallRoom=${hallRoom.id}`);
            await expect(page.getByTestId('test-hall-badge')).toContainText(hallRoom.title, { timeout: 120_000 });
            await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });

            const expected = hallRoom.build();
            const booted = await readRun(page);
            expect(booted.view).toBe('playing');
            expect(booted.tiles).toBe(expected.board?.tiles.length ?? 0);

            const first = hallRoom.script[0]?.step;
            if (first?.do === 'match' && expected.status === 'playing') {
                const halves = (expected.board?.tiles ?? []).filter((tile) => tile.pairKey === first.pairKey).map((tile) => tile.id);
                await page.evaluate(async (ids) => {
                    const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                    for (const id of ids) {
                        useAppStore.getState().pressTile(id);
                    }
                }, halves);
                await expect.poll(async () => (await readRun(page)).progress, { timeout: 45_000 }).toBeGreaterThan(booted.progress);
            }
            expect(errors).toEqual([]);
        });
    }
});
