import { expect, test } from '@playwright/test';
import { startClassicFromMenu } from './playablePathHelpers';

/**
 * Nothing streams once the board is up (`preloadRunAssets`).
 *
 * Before the run preloader, a run from the main menu fetched all eleven game sounds 2.7-5.6s into
 * play (the first flips and matches were silent), a display font 16s in, and the music as the board
 * mounted; the card art was ready only if the menu had idled long enough. This plays the opening
 * turns and holds every asset request made after the board appeared to zero.
 */
test('a run plays from memory: no asset is requested and no card texture drawn after the board appears', async ({ page }) => {
    test.setTimeout(300_000);
    // Every texture the board draws makes a canvas; one made after the board is up is a texture drawn mid-play.
    await page.addInitScript(() => {
        const w = window as unknown as { __lateCanvases: number; __countCanvases: boolean };
        w.__lateCanvases = 0;
        w.__countCanvases = false;
        const create = Document.prototype.createElement;
        Document.prototype.createElement = function (this: Document, tag: string, options?: ElementCreationOptions) {
            if (w.__countCanvases && String(tag).toLowerCase() === 'canvas') w.__lateCanvases += 1;
            return (create as (this: Document, name: string, opts?: ElementCreationOptions) => HTMLElement).call(this, tag, options);
        } as typeof Document.prototype.createElement;
    });
    let boardUp = false;
    const late: string[] = [];
    page.on('request', (request) => {
        const type = request.resourceType();
        if (!boardUp || !['image', 'media', 'font', 'fetch', 'xhr'].includes(type)) return;
        // Code and CSS chunks are the bundler's business; this is about assets.
        if (/\.(ts|tsx|js|mjs|css)(\?|$)/.test(request.url())) return;
        late.push(`${type} ${request.url().replace(/^https?:\/\/[^/]+/, '')}`);
    });

    await startClassicFromMenu(page);
    boardUp = true;
    await page.evaluate(() => {
        (window as unknown as { __countCanvases: boolean }).__countCanvases = true;
    });
    expect(
        await page.evaluate(async () => (await import('/src/renderer/assets/preloadRunAssets.ts')).runAssetsReady())
    ).toBe(true);

    for (let turn = 0; turn < 6; turn += 1) {
        await page.evaluate(async (turnIndex) => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const store = useAppStore.getState();
            const board = store.run?.board;
            if (!board || store.run?.status !== 'playing') return;
            const hidden = board.tiles.filter((tile) => tile.state === 'hidden' && !tile.pairKey.startsWith('__'));
            const first = hidden[0];
            const partner = hidden.find((tile) => tile.pairKey === first?.pairKey && tile.id !== first?.id);
            // A miss on even turns and a match on odd ones, so both sounds and both floaters play.
            const second = turnIndex % 2 === 0 ? hidden.find((tile) => tile.pairKey !== first?.pairKey) : partner;
            if (first && second) {
                store.pressTile(first.id);
                store.pressTile(second.id);
            }
        }, turn);
        await page.waitForTimeout(1500);
    }
    expect(late).toEqual([]);
    // The card textures (every face state) and the proximity badges were drawn before the first frame
    // (`tileTextureWarmup`); before that, the opening turns drew 24 canvases mid-play.
    expect(await page.evaluate(() => (window as unknown as { __lateCanvases: number }).__lateCanvases)).toBe(0);
});
