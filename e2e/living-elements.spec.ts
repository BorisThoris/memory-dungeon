import { test, expect } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

// Run on Windows through Start-IsolatedProcess.ps1, never on the interactive desktop.
test.use({ headless: true, viewport: { width: 1280, height: 800 }, launchOptions: { args: ['--mute-audio'] } });

for (const suit of ['ember', 'tide', 'bone', 'moss'] as const) {
    test(`a single ${suit} pair casts and leaves visible ground without a pop`, async ({ page }, testInfo) => {
        test.setTimeout(180_000);
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
        });
        const save = JSON.parse(buildVisualSaveJson(true, false));
        save.settings.masterVolume = 0;
        save.settings.reduceMotion = true;
        await gotoWithSaveAndQuery(page, JSON.stringify(save), `hallRoom=element-single-${({ ember: 'fire', tide: 'water', bone: 'frost', moss: 'grove' })[suit]}`);
        await expect(page.getByTestId('tile-board-stage').locator('canvas')).toBeVisible({ timeout: 90_000 });
        const beforeIds = await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            return useAppStore.getState().run!.board!.tiles.map((tile) => tile.id);
        });
        for (const column of [1, 2]) {
            await expect.poll(async () => page.evaluate((col) => {
                const api = window as unknown as { __e2eGetTileClientRectAtGrid1: (r: number, c: number) => unknown };
                return api.__e2eGetTileClientRectAtGrid1(1, col) != null;
            }, column)).toBe(true);
            await expect.poll(async () => {
              const point = await page.evaluate((col) => {
                const api = window as unknown as { __e2eGetTileClientRectAtGrid1: (r: number, c: number) => { left: number; top: number; width: number; height: number } };
                const r = api.__e2eGetTileClientRectAtGrid1(1, col);
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
              }, column);
              await page.mouse.click(point.x, point.y);
              return page.evaluate(async (index) => {
                  const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                  const tile = useAppStore.getState().run?.board?.tiles.find((tile) => tile.id === `a-${index + 1}`);
                  return tile != null && tile.state !== 'hidden';
              }, column - 1);
            }, { timeout: 30_000 }).toBe(true);
            if (column === 1) await page.screenshot({ path: testInfo.outputPath(`${suit}-front-and-back.png`) });
        }
        await expect.poll(async () => Number(await page.getByTestId('tile-board-stage').getAttribute('data-element-ground-cells')), { timeout: 30_000 }).toBeGreaterThan(0);
        const result = await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            return { casts: run.elementCastsThisFloor, matched: run.board!.matchedPairs, tiles: run.board!.tiles, ground: run.board!.elementalGround, event: run.lastRealmEvent, impact: run.board!.elementCast };
        });
        expect(result.casts).toBe(1);
        expect(result.matched).toBe(1);
        expect(result.impact?.suit).toBe(suit);
        expect(result.impact?.contacts.length).toBeGreaterThan(0);
        expect(result.impact?.contacts.every(contact => result.tiles[contact.cell]?.id === contact.tileId)).toBe(true);
        expect(result.ground?.filter(Boolean).length).toBeGreaterThan(0);
        expect(Number(await page.getByTestId('tile-board-stage').locator('canvas').getAttribute('data-particle-cast-bursts'))).toBe(0);
        if (suit === 'ember') expect(result.tiles.some((tile) => tile.fuse === 3)).toBe(true);
        if (suit === 'bone') expect(result.tiles.some((tile) => tile.rime === true)).toBe(true);
        if (suit === 'moss') expect(result.tiles.some((tile) => tile.seeded)).toBe(true);
        if (suit === 'tide') expect(result.tiles.some((tile, index) => tile.id !== beforeIds[index])).toBe(true);
        await page.screenshot({ path: `output/playwright/${suit}-terrain.png` });
        await page.getByTestId('element-cast-guide').click();
        await expect(page.getByTestId('element-cast-rules')).toBeVisible();
        await expect(page.getByTestId('element-cast-rules')).toContainText('Every pair casts. Combos make it stronger.');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('element-cast-rules')).not.toBeVisible();
        expect(await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.status)).toBe('playing');
        expect(errors).toEqual([]);
    });
}

test('the cast guide fits desktop, phone and landscape with Back always visible', async ({ page }) => {
    test.setTimeout(180_000);
    await gotoWithSaveAndQuery(page, buildVisualSaveJson(true, false), 'hallRoom=element-flood');
    for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 390, 844], ['landscape', 812, 375]] as const) {
        await page.setViewportSize({ width, height });
        await page.getByTestId('element-cast-guide').click({ timeout: 90_000 });
        const guide = page.getByTestId('element-cast-rules');
        const back = guide.getByRole('button', { name: 'Back', exact: true });
        await expect(guide).toBeVisible();
        const rect = await guide.boundingBox();
        expect(rect!.x).toBeGreaterThanOrEqual(0);
        expect(rect!.x + rect!.width).toBeLessThanOrEqual(width);
        expect(rect!.height).toBeLessThan(height);
        const visibleBack = async () => {
            const button = await back.boundingBox();
            expect(button!.y).toBeGreaterThanOrEqual(rect!.y);
            expect(button!.y + button!.height).toBeLessThanOrEqual(rect!.y + rect!.height);
        };
        await visibleBack();
        await page.screenshot({ path: `output/playwright/cast-guide-${name}-fixed-footer.png` });
        await page.getByTestId('element-cast-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
        await visibleBack();
        await back.click();
        await expect(guide).not.toBeVisible();
    }
});
