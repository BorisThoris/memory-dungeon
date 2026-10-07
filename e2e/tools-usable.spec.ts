import { expect as baseExpect, test, type Page } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery, mainMenuPlayButton, startClassicRunFromModeSelect } from './visualScreenHelpers';
import { dismissStartupIntro } from './startupIntroHelpers';

// A software-rendered WebGL frame can delay even a successful state read past five seconds.
// Keep the actual inventory/board assertions, with the same deadline as room readiness.
const expect = baseExpect.configure({ timeout: 30_000 });

/**
 * Every tool, used the way a player uses it: its dock button pressed, its target picked on the board
 * through the board's own pick handler (the path a click takes after the raycast).
 *
 * The unit suite and the hall walk tools through the rules; this asks whether a player can reach
 * them at all. Written when the question was "are bombs and the other things actually usable?" -
 * the answer for Undo and the Gambit was: only in principle, since both act on a miss and a miss
 * resolved in 850ms (`MISS_DECISION_HOLD_MS` now holds it while either is in hand).
 */

interface Snapshot {
    status: string;
    order: string;
    states: Record<string, string>;
    flipped: string[];
    bombs: number;
    peeks: number;
    peeked: string[];
    shuffles: number;
    region: number;
    pins: string[];
    undo: number;
    flash: number;
    flashed: string[];
}

const read = (page: Page): Promise<Snapshot> =>
    page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const run = useAppStore.getState().run!;
        return {
            status: run.status,
            order: run.board!.tiles.map((tile) => tile.id).join(','),
            states: Object.fromEntries(run.board!.tiles.map((tile) => [tile.id, tile.state])),
            flipped: run.board!.flippedTileIds,
            bombs: run.bombCharges,
            peeks: run.peekCharges,
            peeked: run.peekRevealedTileIds,
            shuffles: run.shuffleCharges,
            region: run.regionShuffleCharges,
            pins: run.pinnedTileIds,
            undo: run.undoUsesThisFloor,
            flash: run.flashPairCharges,
            flashed: run.flashPairRevealedTileIds
        };
    });

const pick = async (page: Page, id: string): Promise<void> => {
    await page.evaluate((tileId) => {
        const w = window as unknown as {
            __e2eGetTileIdAtGrid1: (r: number, c: number) => string | null;
            __e2ePickTileAtGrid1: (r: number, c: number) => void;
        };
        for (let r = 1; r <= 8; r += 1) {
            for (let c = 1; c <= 8; c += 1) {
                if (w.__e2eGetTileIdAtGrid1(r, c) === tileId) {
                    w.__e2ePickTileAtGrid1(r, c);
                    return;
                }
            }
        }
        throw new Error(`no tile ${tileId} on the board`);
    }, id);
};

/** A phone folds the dock into Items (RunShell); open it the way a player would before reaching for a tool. */
const openItemsIfFolded = async (page: Page): Promise<void> => {
    const toggle = page.getByTestId('tool-tray-toggle');
    if ((await toggle.isVisible().catch(() => false)) && (await toggle.getAttribute('aria-expanded')) !== 'true') {
        await toggle.click();
    }
};

const tool = (page: Page, name: RegExp) => page.getByRole('toolbar', { name: /game controls/i }).getByRole('button', { name }).first();

const openRoom = async (page: Page, room: string): Promise<void> => {
    await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), `hallRoom=${room}`);
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
    await expect.poll(async () => (await read(page)).status, { timeout: 30_000 }).toBe('playing');
};

for (const display of [
    { name: 'desktop', width: 1280, height: 720, scale: 1 },
    { name: 'phone', width: 390, height: 844, scale: 1 },
    { name: '4K', width: 3840, height: 2160, scale: 1 },
    { name: 'scaled 4K', width: 1920, height: 1080, scale: 2 }
]) {
    test.describe(`Normal run on ${display.name}`, () => {
        test.use({ viewport: { width: display.width, height: display.height }, deviceScaleFactor: display.scale });
        test('starts with a usable bomb and keeps rendering stable through a shuffle', async ({ page }) => {
            test.setTimeout(240_000);
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            // Exercise the fresh tutorial at desktop and existing profiles at 4K, with motion on.
            await gotoWithSaveAndQuery(page, buildVisualSaveJson(display.name !== 'desktop', false), '');
            await dismissStartupIntro(page);
            await mainMenuPlayButton(page).click();
            await startClassicRunFromModeSelect(page);
            await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
            await expect.poll(async () => (await read(page)).status).toBe('playing');
            await openItemsIfFolded(page);
            const bomb = page.getByTestId('tool-bomb');
            await expect(bomb).toBeVisible();
            await expect(bomb).toBeEnabled();
            expect((await read(page)).bombs).toBe(1);
            await bomb.click();
            if (display.name === 'phone') {
                // The bag closes on a choice so the board is clear to aim at; Items says what is armed.
                await expect(page.getByTestId('tool-tray')).toHaveCount(0);
                await expect(page.getByTestId('tool-tray-toggle')).toHaveAccessibleName(/choose a card to bomb.*armed/i);
            } else {
                await expect(bomb).toHaveAttribute('aria-pressed', 'true');
                await expect(bomb).toHaveAccessibleName(/choose a card to bomb/i);
            }
            // The room is one canvas the size of its art on every display: 4K gets the full scene
            // (it was once held to lean, when each light was a blended layer the size of the screen)
            // and nothing in the room is blended by the page at any size.
            const scene = page.getByTestId('gameplay-scene');
            if (display.name.includes('4K')) {
                await expect(scene).toHaveAttribute('data-scene-effect-tier', 'full');
            }
            expect(
                await scene.evaluate((node) => {
                    const canvas = node.querySelector<HTMLCanvasElement>('[data-testid="gameplay-scene-canvas"]');
                    const blended = [...node.querySelectorAll('*')].filter((el) => getComputedStyle(el).mixBlendMode !== 'normal').length;
                    return { width: canvas?.width, height: canvas?.height, blended, images: node.querySelectorAll('img').length };
                })
            ).toEqual({ width: 1376, height: 768, blended: 0, images: 0 });
            const target = await page.evaluate(() => {
                const w = window as unknown as {
                    __e2eGetTileClientRectAtGrid1: (r: number, c: number) => { left: number; top: number; width: number; height: number } | null;
                    __e2eGetTileIdAtGrid1: (r: number, c: number) => string | null;
                };
                const rect = w.__e2eGetTileClientRectAtGrid1(1, 1);
                if (!rect) throw new Error('The first card was not rendered');
                return { ...rect, id: w.__e2eGetTileIdAtGrid1(1, 1)! };
            });
            // A real mouse click exercises the canvas raycast, not an injected power inventory.
            await page.mouse.click(target.left + target.width / 2, target.top + target.height / 2);
            await expect.poll(async () => (await read(page)).states[target.id]).toBe('removed');
            expect((await read(page)).bombs).toBe(0);
            expect(Object.values((await read(page)).states).filter((state) => state === 'removed')).toHaveLength(2);

            const canvas = page.getByTestId('tile-board-stage').locator('canvas');
            await canvas.evaluate((node: HTMLCanvasElement) => {
                node.dataset.resizeCount = '0';
                node.dataset.contextLosses = '0';
                node.dataset.resizeEvents = '[]';
                new MutationObserver((records) => {
                    node.dataset.resizeCount = String(Number(node.dataset.resizeCount) + records.length);
                    const events = JSON.parse(node.dataset.resizeEvents!);
                    events.push(...records.map((record) => ({ attribute: record.attributeName, old: record.oldValue,
                        width: node.width, height: node.height, cssWidth: node.clientWidth, cssHeight: node.clientHeight })));
                    node.dataset.resizeEvents = JSON.stringify(events);
                }).observe(node, { attributes: true, attributeFilter: ['width', 'height'], attributeOldValue: true });
                node.addEventListener('webglcontextlost', () => { node.dataset.contextLosses = '1'; });
            });
            await openItemsIfFolded(page);
            await page.getByTestId('tool-shuffle').click();
            await expect.poll(async () => (await read(page)).shuffles).toBe(0);
            await page.waitForTimeout(4000);
            const allocation = await canvas.evaluate((node: HTMLCanvasElement) => ({
                pixels: node.width * node.height, resizes: node.dataset.resizeCount, losses: node.dataset.contextLosses,
                events: JSON.parse(node.dataset.resizeEvents!)
            }));
            expect(allocation.pixels).toBeLessThanOrEqual(3840 * 2160);
            expect(allocation.events).toEqual([]);
            expect(allocation.losses).toBe('0');
            expect(errors).toEqual([]);
            await page.screenshot({ path: `test-results/normal-run-${display.name.replaceAll(' ', '-')}.png` });
        });
    });
}

test.describe('Every tool can be used from the dock', () => {
    test.setTimeout(240_000);

    test('bomb: turn a card, press Bomb, and its pair is gone', async ({ page }) => {
        await openRoom(page, 'bomb');
        await expect(tool(page, /bomb/i)).toBeEnabled();
        await pick(page, 'b-1');
        await expect(tool(page, /bomb/i)).toBeEnabled();
        await tool(page, /bomb/i).click();
        await expect.poll(async () => (await read(page)).states['b-2']).toBe('removed');
        expect((await read(page)).bombs).toBe(0);
    });

    test('ignite: at Inferno press Ignite, turn four cards with nothing resolving, press Resolve', async ({ page }) => {
        await openRoom(page, 'zone');
        await expect(tool(page, /ignite/i)).toBeEnabled();
        await tool(page, /ignite/i).click();
        await expect.poll(async () => page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            return useAppStore.getState().run?.zone?.pairs ?? 0;
        })).toBe(3);
        await expect(page.getByTestId('zone-veil')).toHaveAttribute('data-zone', 'true');
        await expect(page.getByTestId('hud-zone')).toHaveText('Zone · 0 of 6 cards');
        for (const id of ['a-1', 'a-2', 'c-1', 'd-1']) await pick(page, id);
        await expect.poll(async () => (await read(page)).flipped.length).toBe(4);
        expect((await read(page)).status).toBe('playing');
        await expect(tool(page, /resolve/i)).toBeEnabled();
        await tool(page, /resolve/i).click();
        await expect.poll(async () => (await read(page)).states['a-2']).toBe('matched');
        const after = await read(page);
        expect(after.flipped).toEqual([]);
        expect(after.states['c-1']).toBe('hidden');
        await expect(page.getByTestId('zone-veil')).toHaveAttribute('data-zone', 'false');
    });

    test('bomb: cancel targeting and preserve the last-pair guard', async ({ page }) => {
        await openRoom(page, 'bomb');
        const bomb = page.getByTestId('tool-bomb');
        await bomb.click();
        await expect(bomb).toHaveAttribute('aria-pressed', 'true');
        await bomb.click();
        await expect(bomb).toHaveAttribute('aria-pressed', 'false');
        await bomb.click();
        await page.keyboard.press('Escape');
        await expect(bomb).toHaveAttribute('aria-pressed', 'false');
        expect((await read(page)).status).toBe('playing');
        expect((await read(page)).bombs).toBe(1);
        await pick(page, 'b-1');
        expect((await read(page)).states['b-1']).toBe('flipped');
        expect((await read(page)).bombs).toBe(1);
        await openRoom(page, 'bomb-last-pair');
        await expect(page.getByTestId('tool-bomb')).toBeDisabled();
        expect((await read(page)).bombs).toBe(1);
    });

    test('peek: press Peek, pick a card, it shows', async ({ page }) => {
        await openRoom(page, 'peek');
        await pick(page, 'a-1');
        await expect(page.getByTestId('tool-peek')).toBeDisabled();
        await expect(page.getByTestId('tool-peek')).toHaveAccessibleName('Finish the current flip first');
        await pick(page, 'a-2');
        await expect.poll(async () => (await read(page)).status, { timeout: 30_000 }).toBe('playing');
        await tool(page, /peek/i).click();
        await pick(page, 'b-1');
        await expect.poll(async () => (await read(page)).peeked, { timeout: 30_000 }).toContain('b-1');
        expect((await read(page)).peeks).toBe(0);
    });

    test('shuffle: press Shuffle and the hidden cards move', async ({ page }) => {
        await openRoom(page, 'shuffle');
        const before = await read(page);
        await tool(page, /shuffle hidden/i).click();
        await expect.poll(async () => (await read(page)).shuffles).toBe(before.shuffles - 1);
        expect((await read(page)).order).not.toBe(before.order);
    });

    test('swap: press Swap, pick two cards, they trade places', async ({ page }) => {
        await openRoom(page, 'tile-swap');
        const before = await read(page);
        await tool(page, /swap two/i).click();
        await pick(page, 'a-1');
        await pick(page, 'f-2');
        await expect.poll(async () => (await read(page)).order).not.toBe(before.order);
        expect((await read(page)).region).toBe(before.region - 1);
    });

    test('row shuffle: press the row tool, pick a card, its row moves', async ({ page }) => {
        await openRoom(page, 'row-shuffle');
        const before = await read(page);
        await tool(page, /shuffle one row/i).click();
        await pick(page, 'a-1');
        await expect.poll(async () => (await read(page)).order).not.toBe(before.order);
        expect((await read(page)).region).toBe(before.region - 1);
    });

    test('pin: press Pin, pick a card, it is pinned', async ({ page }) => {
        await openRoom(page, 'pin');
        await tool(page, /pin up to/i).click();
        await pick(page, 'a-1');
        await expect.poll(async () => (await read(page)).pins).toContain('a-1');
    });

    test('flash: press the flash tool and a pair shows', async ({ page }) => {
        await openRoom(page, 'flash-pair');
        await tool(page, /reveal a random/i).click();
        await expect.poll(async () => (await read(page)).flashed.length).toBe(2);
        expect((await read(page)).flash).toBe(0);
    });

    test('gambit: after a miss, a third card completes the pair', async ({ page }) => {
        await openRoom(page, 'gambit');
        await pick(page, 'a-1');
        await pick(page, 'b-1');
        await pick(page, 'a-2');
        await expect.poll(async () => (await read(page)).states['a-2'], { timeout: 30_000 }).toBe('matched');
        expect((await read(page)).states['b-1']).toBe('hidden');
    });

    test('undo: after a miss, press Undo and both cards go back with nothing spent but the undo', async ({ page }) => {
        await openRoom(page, 'undo');
        // Headless WebGL runs at a few frames a second; the player's own game-speed setting stretches
        // the window so the test measures the button, not the renderer.
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            useAppStore.setState({ run: { ...run, resolveDelayMultiplier: 6 } });
        });
        await pick(page, 'a-1');
        await pick(page, 'b-1');
        await expect(tool(page, /undo the flip/i)).toBeEnabled({ timeout: 10_000 });
        await tool(page, /undo the flip/i).click({ force: true });
        await expect.poll(async () => (await read(page)).undo, { timeout: 30_000 }).toBe(0);
        const after = await read(page);
        expect(after.states['a-1']).toBe('hidden');
        expect(after.states['b-1']).toBe('hidden');
    });
});
