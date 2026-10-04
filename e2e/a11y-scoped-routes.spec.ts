import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';
test.use({ headless: true, launchOptions: { args: ['--mute-audio'] } });

const seriousOnly = (violations: { impact?: string | null }[]): typeof violations =>
    violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

test.describe('a11y — scoped axe (REF-094)', () => {
    test.describe.configure({ timeout: 90_000 });

    test('main menu after intro: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });

    test('settings surface: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        await page.getByRole('button', { name: /settings/i }).click();
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible({ timeout: 15_000 });
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });

    /*
     * The store stop, with a keyboard and a screen reader's ears. Measured before the fix: a buy
     * said nothing at all, the button that bought the last thing the gold covered went disabled
     * under focus and dropped it on <body>, and the board under the sheet was not inert.
     */
    test('camp: ranks and costs are clear, keyboard focus survives, mobile scrolls, Escape continues', async ({ page }) => {
        test.setTimeout(600_000);
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setViewportSize({ width: 1280, height: 800 });
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 150_000 });
        await page.waitForFunction(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.status === 'playing', null, { timeout: 60_000 });
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            useAppStore.setState(state => ({ run: { ...state.run!, realmId: 'tide', realmSeverity: 'calm' } }));
        });
        for (const pair of ['a', 'b']) {
            await page.evaluate(async key => {
                const store = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState();
                store.pressTile(`${key}-1`);
                store.pressTile(`${key}-2`);
            }, pair);
            await page.waitForTimeout(1200);
        }
        const sheet = page.getByTestId('store-sheet');
        await expect(sheet).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('realm-travel')).toHaveCount(0);
        await expect(page.getByTestId('floor-clear-essence')).toHaveCount(0);
        await expect(sheet).not.toContainText(/essence|forge|choose.*arena/i);
        await expect(page.locator('[data-a11y-gameplay-inert="true"]')).toHaveCount(1);
        const { violations } = await new AxeBuilder({ page }).include('[data-testid="store-sheet"]').analyze();
        expect(seriousOnly(violations)).toEqual([]);
        await expect(page.getByTestId('camp-next-arena')).toContainText('Randomly selected');
        const destination = await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.nextRealm!);
        const buy = page.getByTestId('store-buy-long_look');
        await expect(buy).toHaveAccessibleName('Buy long look for 8 gold');
        await page.getByTestId('store-descend').focus();
        for (let i = 0; i < 10 && !await buy.evaluate(node => node === document.activeElement); i++) await page.keyboard.press('Tab');
        await expect(buy).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('store-receipt')).toContainText('Upgraded Long Look to rank 1 of 3.');
        await expect(page.getByTestId('store-row-long_look')).toContainText('1/3');
        for (let i = 0; i < 3 && await buy.isEnabled(); i++) {
            await buy.focus();
            await page.keyboard.press('Enter');
        }
        await expect(buy).toBeDisabled();
        expect(await page.evaluate(() => {
            const active = document.activeElement;
            return active instanceof HTMLButtonElement && !active.disabled && !!active.closest('[data-testid="store-sheet"]');
        })).toBe(true);
        for (const [name, width, height] of [['desktop', 1280, 800], ['phone', 390, 844], ['small-phone', 320, 568], ['landscape', 812, 375]] as const) {
            await page.setViewportSize({ width, height });
            await expect(page.getByTestId('store-descend')).toBeInViewport({ ratio: 1 });
            // Batch geometry reads and real scrolls inside the page: low-CPU isolated runners
            // otherwise spend most of this check taking protocol snapshots of each assertion.
            const buttons = await sheet.evaluate(async node => {
                const scroller = node.querySelector('[data-testid="store-rows"]')!;
                const checks = [];
                for (const button of node.querySelectorAll<HTMLButtonElement>('[data-testid^="store-buy-"]')) {
                    button.scrollIntoView({ block: 'nearest' });
                    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                    const r = button.getBoundingClientRect();
                    const viewport = scroller.getBoundingClientRect();
                    checks.push({ id: button.dataset.testid, reachable: r.top >= viewport.top - 1 && r.bottom <= viewport.bottom + 1 && r.left >= 0 && r.right <= innerWidth, touchSize: r.height >= 44 && r.width >= 44 });
                }
                return checks;
            });
            expect(buttons).toHaveLength(6);
            for (const button of buttons) expect(button, button.id).toMatchObject({ reachable: true, touchSize: true });
            await page.getByTestId('store-rows').evaluate(node => node.scrollTo(0, 0));
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await page.screenshot({ path: `output/playwright/camp-${name}.png` });
        }
        const remainingGold = await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!.gold);
        await page.keyboard.press('Escape');
        await expect(sheet).toBeHidden({ timeout: 20_000 });
        await expect(page.getByTestId('realm-travel')).toHaveCount(0);
        await expect.poll(async () => page.evaluate(async () => {
            const run = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!;
            return { floor: run.board?.level, realm: run.realmId, gold: run.gold, rank: run.storePurchases?.long_look };
        }), { timeout: 45_000 }).toEqual({ floor: 4, realm: destination.realmId, gold: remainingGold, rank: 1 });
        expect(errors).toEqual([]);
    });

    test('ordinary floor clears continue automatically without a route choice', async ({ page }) => {
        test.setTimeout(180_000);
        await gotoWithSaveAndQuery(page, buildVisualSaveJson(true), 'hallRoom=store-stop');
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 90_000 });
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            useAppStore.setState(state => ({ run: { ...state.run!, realmId: 'tide', board: { ...state.run!.board!, level: 1 } } }));
        });
        for (const pair of ['a', 'b']) {
            await page.evaluate(async key => {
                const store = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState();
                store.pressTile(`${key}-1`); store.pressTile(`${key}-2`);
            }, pair);
            await page.waitForTimeout(1200);
        }
        await expect.poll(async () => page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.board?.level), { timeout: 45_000 }).toBe(2);
        await expect(page.getByTestId('store-sheet')).toHaveCount(0);
        await expect(page.getByTestId('realm-travel')).toHaveCount(0);
    });

    test('in-run level 1: serious violations only', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await dismissStartupIntro(page);
        await page.getByRole('button', { name: /^play$/i }).click();
        await page.getByRole('button', { name: /start run/i }).click();
        await expect(page.getByRole('heading', { name: /level 1/i })).toBeVisible({ timeout: 30_000 });
        const { violations } = await new AxeBuilder({ page })
            .disableRules(['color-contrast'])
            .analyze();
        expect(seriousOnly(violations)).toEqual([]);
    });
});
