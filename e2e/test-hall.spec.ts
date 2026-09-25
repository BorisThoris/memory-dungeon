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

test.describe('Sticky fingers, in its room', () => {
    test('a match locks a face-down card beside it, the lock refuses an opening press, and the line says why', async ({ page }) => {
        /*
         * The Trap Hall's lock used to sit on the matched card itself, so the floor-7 boss mutator did
         * nothing a player could meet; and a lock after a trait-free match was captioned "Stasis".
         */
        test.setTimeout(240_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=sticky-fingers');
        await expect(page.getByTestId('test-hall-badge')).toContainText('Sticky fingers', { timeout: 150_000 });
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
        const press = (ids: string[]) =>
            page.evaluate(async (tileIds) => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                for (const id of tileIds) useAppStore.getState().pressTile(id);
            }, ids);
        const lock = () =>
            page.evaluate(async () => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const { run } = useAppStore.getState();
                const tile = run?.stickyBlockIndex != null ? run.board?.tiles[run.stickyBlockIndex] : null;
                return { id: tile?.id ?? null, state: tile?.state ?? null, flipped: run?.board?.flippedTileIds ?? [] };
            });

        await press(['a-1', 'a-2']);
        await expect.poll(async () => (await lock()).id, { timeout: 45_000 }).toBe('b-1');
        expect((await lock()).state).toBe('hidden');
        await expect(page.getByTestId('run-shell-line')).toContainText('Sticky fingers', { timeout: 15_000 });
        await expect(page.getByTestId('run-shell-line')).not.toContainText('Stasis');

        // Pressed as an opener, the locked card stays down (the room's unit script covers it opening second).
        await press(['b-1']);
        expect((await lock()).flipped).toEqual([]);
    });
});

test.describe('The store stop, in the store-stop room', () => {
    test('describes everything it sells, inside the dialog, and opens on Descend', async ({ page }) => {
        test.setTimeout(240_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
        for (const pair of ['a', 'b']) {
            await page.evaluate(async (key) => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const store = useAppStore.getState();
                store.pressTile(`${key}-1`);
                store.pressTile(`${key}-2`);
            }, pair);
            await page.waitForTimeout(1200);
        }
        await expect(page.getByTestId('store-sheet')).toBeVisible({ timeout: 30_000 });
        // The modal body clips (it never scrolls), so a row has to sit inside the body, not merely the dialog.
        const box = await page.getByTestId('store-rows').locator('..').boundingBox();
        const ids = ['miss', 'peek', 'shuffle', 'bomb', 'deep_pockets', 'gilded_chain', 'long_look', 'tallow_candle'];
        for (const id of ids) {
            // Gen 263: the last three descriptions were clipped while their buy buttons stayed.
            const row = page.getByTestId(`store-row-${id}`);
            await expect(row).toBeVisible();
            const rowBox = await row.boundingBox();
            expect(rowBox && box && rowBox.y + rowBox.height <= box.y + box.height, `${id} row inside the dialog body`).toBe(true);
            await expect(page.getByTestId(`store-buy-${id}`)).toBeVisible();
        }
        await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Descend');
    });
});

test.describe('The store stop on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('every item can be scrolled to and bought, none cut off by the dialog', async ({ page }) => {
        test.setTimeout(240_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
        for (const pair of ['a', 'b']) {
            await page.evaluate(async (key) => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const store = useAppStore.getState();
                store.pressTile(`${key}-1`);
                store.pressTile(`${key}-2`);
            }, pair);
            await page.waitForTimeout(1200);
        }
        await expect(page.getByTestId('store-sheet')).toBeVisible({ timeout: 30_000 });
        // Gen 263: on a phone the last three rows sat below a dialog body that clips, unseen and unbuyable.
        // The body must hold its content (it clips, never scrolls), and the list must be the part that scrolls;
        // a script can scroll a clipping box, so reaching the buttons alone would not prove a player can.
        const layout = await page.getByTestId('store-rows').evaluate((list) => {
            const body = list.parentElement!;
            return { bodyClips: body.scrollHeight > body.clientHeight + 1, listScrolls: getComputedStyle(list).overflowY };
        });
        expect(layout.bodyClips).toBe(false);
        expect(['auto', 'scroll']).toContain(layout.listScrolls);
        for (const id of ['miss', 'peek', 'shuffle', 'bomb', 'deep_pockets', 'gilded_chain', 'long_look', 'tallow_candle']) {
            const buy = page.getByTestId(`store-buy-${id}`);
            await buy.scrollIntoViewIfNeeded();
            const list = await page.getByTestId('store-rows').boundingBox();
            const button = await buy.boundingBox();
            expect(list && button && button.y >= list.y - 1 && button.y + button.height <= list.y + list.height + 1, `${id} reachable`).toBe(true);
        }
        await expect(page.getByRole('button', { name: 'Descend' })).toBeInViewport();
    });
});

test.describe('The preview chip on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('sits above the cards, not over them or the caption', async ({ page }) => {
        test.setTimeout(240_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=clean-pop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
        await page.waitForTimeout(1500);
        type Rect = { left: number; top: number; width: number; height: number };
        const first = await page.evaluate(
            () => (window as unknown as { __e2eGetTileClientRectAtGrid1: (r: number, c: number) => Rect }).__e2eGetTileClientRectAtGrid1(1, 1)
        );
        await page.touchscreen.tap(first.left + first.width / 2, first.top + first.height / 2);
        await expect(page.getByTestId('trait-preview-chip')).toBeVisible({ timeout: 10_000 });
        // Reported on a phone: the chip sat over the bottom row of cards and the caption, and stayed after every tap.
        const overlaps = await page.evaluate(() => {
            const chip = document.querySelector('[data-testid="trait-preview-chip"]')!.getBoundingClientRect();
            const w = window as unknown as { __e2eGetTileClientRectAtGrid1: (r: number, c: number) => Rect | null };
            let count = 0;
            for (let r = 1; r <= 8; r += 1) {
                for (let c = 1; c <= 12; c += 1) {
                    const t = w.__e2eGetTileClientRectAtGrid1(r, c);
                    if (t && !(t.top + t.height <= chip.top || t.top >= chip.bottom || t.left + t.width <= chip.left || t.left >= chip.right)) count += 1;
                }
            }
            return count;
        });
        expect(overlaps).toBe(0);
    });
});
