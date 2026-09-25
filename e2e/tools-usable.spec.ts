import { expect, test, type Page } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

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

const tool = (page: Page, name: RegExp) => page.getByRole('toolbar', { name: /game controls/i }).getByRole('button', { name }).first();

const openRoom = async (page: Page, room: string): Promise<void> => {
    await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), `hallRoom=${room}`);
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
    await expect.poll(async () => (await read(page)).status, { timeout: 30_000 }).toBe('playing');
};

test.describe('Every tool can be used from the dock', () => {
    test.setTimeout(240_000);

    test('bomb: turn a card, press Bomb, and its pair is gone', async ({ page }) => {
        await openRoom(page, 'bomb');
        await expect(tool(page, /bomb/i)).toBeDisabled();
        await pick(page, 'b-1');
        await expect(tool(page, /bomb/i)).toBeEnabled();
        await tool(page, /bomb/i).click();
        await expect.poll(async () => (await read(page)).states['b-2']).toBe('removed');
        expect((await read(page)).bombs).toBe(0);
    });

    test('peek: press Peek, pick a card, it shows', async ({ page }) => {
        await openRoom(page, 'peek');
        await tool(page, /peek/i).click();
        await pick(page, 'a-1');
        await expect.poll(async () => (await read(page)).peeked).toContain('a-1');
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
