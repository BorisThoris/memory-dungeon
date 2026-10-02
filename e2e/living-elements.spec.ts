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
        }
        await expect.poll(async () => Number(await page.getByTestId('tile-board-stage').getAttribute('data-element-ground-cells')), { timeout: 30_000 }).toBeGreaterThan(0);
        const result = await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const run = useAppStore.getState().run!;
            return { casts: run.elementCastsThisFloor, matched: run.board!.matchedPairs, tiles: run.board!.tiles, ground: run.board!.elementalGround, event: run.lastRealmEvent };
        });
        expect(result.casts).toBe(1);
        expect(result.matched).toBe(1);
        expect(result.ground?.filter(Boolean).length).toBeGreaterThan(0);
        if (suit === 'ember') expect(result.tiles.some((tile) => tile.fuse === 3)).toBe(true);
        if (suit === 'bone') expect(result.tiles.some((tile) => tile.frost === 1)).toBe(true);
        if (suit === 'moss') expect(result.tiles.some((tile) => tile.vined)).toBe(true);
        if (suit === 'tide') expect(result.tiles.some((tile, index) => tile.id !== beforeIds[index])).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${suit}-ground.png`) });
        await page.getByTestId('element-cast-guide').click();
        await expect(page.getByTestId('element-cast-rules')).toBeVisible();
        await expect(page.getByTestId('element-cast-rules')).toContainText('Every elemental pair casts');
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('element-cast-rules')).not.toBeVisible();
        expect(await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.status)).toBe('playing');
        expect(errors).toEqual([]);
    });
}

test('the cast guide fits a phone and closes without losing the board', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithSaveAndQuery(page, buildVisualSaveJson(true, false), 'hallRoom=element-flood');
    await page.getByTestId('element-cast-guide').click({ timeout: 90_000 });
    const guide = page.getByTestId('element-cast-rules');
    await expect(guide).toBeVisible();
    const rect = await guide.boundingBox();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(390);
    expect(rect!.height).toBeLessThan(844);
    await page.screenshot({ path: testInfo.outputPath('cast-guide-phone.png') });
    await page.getByRole('button', { name: 'Back to the board' }).click();
    await expect(guide).not.toBeVisible();
});
