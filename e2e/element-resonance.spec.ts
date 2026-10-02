import { expect as baseExpect, test, type Page } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

/**
 * Resonance in a real browser (`element-resonance-rules.ts`, 2026-10-02): every card gives off its
 * own material through the board's particle pool, the strip counts the stacks and the streak, and a
 * primed streak meeting another element stamps its reaction. Screenshots in `output/playwright/`.
 */
const expect = baseExpect.configure({ timeout: 45_000 });
test.use({ headless: true, launchOptions: { args: ['--mute-audio'] }, viewport: { width: 1280, height: 800 } });

const canvas = (page: Page) => page.getByTestId('tile-board-stage').locator('canvas');
const count = async (page: Page, key: string): Promise<number> => Number(await canvas(page).getAttribute(`data-particle-${key}`));

const cardPoint = async (page: Page, tileId: string) =>
    page.evaluate((id) => {
        const w = window as unknown as {
            __e2eGetTileIdAtGrid1: (r: number, c: number) => string | null;
            __e2eGetTileClientRectAtGrid1: (r: number, c: number) => { left: number; top: number; width: number; height: number } | null;
        };
        for (let r = 1; r <= 12; r += 1) for (let c = 1; c <= 12; c += 1) {
            if (w.__e2eGetTileIdAtGrid1(r, c) !== id) continue;
            const rect = w.__e2eGetTileClientRectAtGrid1(r, c);
            if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        }
        throw new Error(`No rendered card ${id}`);
    }, tileId);

const pick = async (page: Page, tileId: string): Promise<void> => {
    await expect.poll(async () => {
        const point = await cardPoint(page, tileId);
        await page.mouse.click(point.x, point.y);
        return page.evaluate(async (id) => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const state = useAppStore.getState().run?.board?.tiles.find((tile) => tile.id === id)?.state;
            return state !== undefined && state !== 'hidden';
        }, tileId);
    }).toBe(true);
};

const runField = <T>(page: Page, read: string): Promise<T> =>
    page.evaluate(async (key) => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        return (useAppStore.getState().run as unknown as Record<string, unknown>)?.[key] as never;
    }, read) as Promise<T>;

test('cards give off their element, the strip counts the stacks, and fire meeting water is Steam', async ({ page }) => {
    test.setTimeout(300_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
    });
    const save = JSON.parse(buildVisualSaveJson(true, false));
    save.settings.graphicsQuality = 'high';
    save.settings.masterVolume = 0;
    await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=element-steam');
    await expect(canvas(page)).toBeVisible({ timeout: 150_000 });

    // Every face-down card is its material in the air: flame, liquid, ice, leaf.
    await expect.poll(() => count(page, 'element-bursts'), { timeout: 90_000 }).toBeGreaterThan(8);
    await page.screenshot({ path: 'output/playwright/element-motes.png' });

    // One fire match is in hand from the floor above; a second primes the streak.
    await expect(page.getByTestId('hud-resonance-streak')).toHaveText('×1');
    await pick(page, 'a-1');
    await pick(page, 'a-2');
    await expect.poll(() => runField<{ links: number } | null>(page, 'elementStreak').then((streak) => streak?.links)).toBe(2);
    await expect(page.getByTestId('hud-resonance-ember')).toHaveAttribute('data-primed', 'true');
    await expect(page.getByTestId('hud-resonance-ember')).toContainText('2');
    await page.screenshot({ path: 'output/playwright/element-primed.png' });

    // Water on the primed fire: Steam.
    await pick(page, 'b-1');
    await pick(page, 'b-2');
    await expect.poll(() => runField<number>(page, 'elementReactionsThisFloor')).toBe(1);
    await expect.poll(() => runField<{ kind: string } | null>(page, 'lastRealmEvent').then((event) => event?.kind)).toBe('steam');
    await expect(page.getByTestId('hud-resonance-tide')).toHaveAttribute('data-in-hand', 'true');
    await page.screenshot({ path: 'output/playwright/element-steam.png' });
    await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=element-blocks');
    await expect(canvas(page)).toBeVisible({ timeout: 150_000 });
    await pick(page, 'a-1'); await pick(page, 'a-2');
    await expect.poll(() => count(page, 'cast-bursts')).toBeGreaterThan(0);
    expect(await count(page, 'cast-bursts')).toBeLessThanOrEqual(19);
    await page.screenshot({ path: 'output/playwright/quiet-cast-desktop.png' });
    const impact = await page.evaluate(async () => {
        const run = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!;
        return { contacts: run.board!.elementCast!.contacts, blooms: run.board!.tiles.filter(t => t.seeded === 2).length,
            locks: run.board!.tiles.filter(t => t.vined || t.frost).length };
    });
    expect(impact.blooms).toBe(6);
    expect(impact.locks).toBe(0);
    expect(new Set(impact.contacts.map(c => c.outcome)).size).toBe(3);
    expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
    test('the strip hangs under the realm chip and covers nothing', async ({ page }) => {
        test.setTimeout(300_000);
        const save = JSON.parse(buildVisualSaveJson(true, false));
        save.settings.masterVolume = 0;
        await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=element-flood');
        await expect(page.getByTestId('hud-resonance')).toBeVisible({ timeout: 150_000 });
        await expect(page.getByTestId('hud-resonance-tide')).toContainText('6');
        await page.screenshot({ path: 'output/playwright/element-strip-phone.png' });
        await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=element-blocks');
        await expect(canvas(page)).toBeVisible({ timeout: 150_000 });
        await pick(page, 'a-1'); await pick(page, 'a-2');
        await expect.poll(() => count(page, 'cast-bursts')).toBeGreaterThan(0);
        await page.screenshot({ path: 'output/playwright/quiet-cast-phone.png' });
    });
});
