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
            const expected = hallRoom.build();
            await expect(expected.godRun ? page.locator('[data-god-run]') : page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
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
        // The store is the room now: every ware is a button on its object, on screen, and says what
        // it does when the pointer or focus is on it (Gen 263's clipped descriptions cannot recur -
        // there is no body to clip - but a hotspot can still fall off a viewport, so each is checked).
        const viewport = page.viewportSize()!;
        // The stop stocks its shelves from the seed (rollStoreStock): a miss and, at the first stop, a bomb
        // are always there; the rest of the shelves are what the roll put on them, and nothing else.
        const ids = await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.storeStock ?? []);
        expect(ids).toContain('miss');
        expect(ids).toContain('bomb');
        expect(ids.length).toBeLessThan(8);
        for (const id of ids) {
            const buy = page.getByTestId(`store-buy-${id}`);
            await expect(buy).toBeVisible();
            await buy.scrollIntoViewIfNeeded();
            const box = (await buy.boundingBox())!;
            expect(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${id} on screen`).toBe(true);
            await buy.hover();
            await expect(page.getByTestId(`store-row-${id}`)).toBeVisible();
        }
        await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Continue to floor 4 →');
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
        // The store is the room: on a phone the plate is cover-fitted, so the wares at the room's
        // edges can slide off the sides. Every hotspot has to be on screen and buyable, unscrolled.
        // Give this fixture enough gold and room in the bank.
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            useAppStore.setState({ run: { ...run, gold: 100, missBank: [{ floor: 3, misses: 1 }] } });
        });
        const stocked = await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.storeStock ?? []);
        expect(stocked.length).toBeGreaterThan(2);
        for (const id of stocked) {
            const buy = page.getByTestId(`store-buy-${id}`);
            const viewport = page.viewportSize()!;
            await buy.scrollIntoViewIfNeeded();
            const button = (await buy.boundingBox())!;
            expect(button.x >= 0 && button.y >= 0 && button.x + button.width <= viewport.width && button.y + button.height <= viewport.height, `${id} on screen`).toBe(true);
            await expect(buy).toBeEnabled();
            await buy.click();
            await expect.poll(() => page.evaluate(async (item) => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                return useAppStore.getState().run?.storePurchases?.[item];
            }, id), { timeout: 30_000 }).toBe(1);
        }
        await expect(page.getByTestId('store-descend')).toBeInViewport();
        const inventory = () => page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            return { level: run.board!.level, bombs: run.bombCharges, peeks: run.peekCharges,
                shuffles: run.shuffleCharges, relics: run.relics, gold: run.gold };
        });
        const bought = await inventory();
        // Everything the stop stocked was bought, and only that: the bare shelves stay bare.
        expect(bought.bombs).toBe(2);
        if (stocked.includes('peek')) expect(bought.peeks).toBeGreaterThan(0);
        if (stocked.includes('shuffle')) expect(bought.shuffles).toBeGreaterThan(0);
        expect([...(bought.relics ?? [])].sort()).toEqual(stocked.filter((id) => !['miss', 'peek', 'shuffle', 'bomb'].includes(id)).sort());
        expect(bought.gold).toBeLessThan(100);
        await page.getByTestId('store-descend').click();
        await expect.poll(async () => (await inventory()).level, { timeout: 30_000 }).toBe(4);
        const carried = await inventory();
        expect(carried.bombs).toBe(bought.bombs);
        expect(carried.peeks).toBeGreaterThanOrEqual(bought.peeks);
        expect(carried.shuffles).toBeGreaterThanOrEqual(bought.shuffles);
        expect(carried.relics).toEqual(bought.relics);
    });
});

test.describe('The board without a preview popup', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('keeps touch, hover and keyboard selection on the cards', async ({ page }) => {
        test.setTimeout(240_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=clean-pop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
        await page.waitForTimeout(1500);
        type Rect = { left: number; top: number; width: number; height: number };
        const first = await page.evaluate(
            () => (window as unknown as { __e2eGetTileClientRectAtGrid1: (r: number, c: number) => Rect }).__e2eGetTileClientRectAtGrid1(1, 1)
        );
        await page.touchscreen.tap(first.left + first.width / 2, first.top + first.height / 2);
        await expect.poll(() => page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            return useAppStore.getState().run?.board?.flippedTileIds.length;
        })).toBe(1);
        await expect(page.getByTestId('trait-preview-chip')).toHaveCount(0);
        await page.mouse.move(first.left + first.width / 2, first.top + first.height / 2);
        await expect(page.getByTestId('trait-preview-chip')).toHaveCount(0);
        await page.getByRole('application').focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByTestId('trait-preview-chip')).toHaveCount(0);
        await page.screenshot({ path: 'output/playwright/board-no-preview-phone.png' });
    });
});
