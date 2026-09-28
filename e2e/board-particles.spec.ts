import { expect as baseExpect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { buildVisualSaveJson, gotoWithSaveAndQuery } from './visualScreenHelpers';

const expect = baseExpect.configure({ timeout: 45_000 });
test.use({ headless: true, launchOptions: { args: ['--mute-audio'] } });
const canvas = (page: Page) => page.getByTestId('tile-board-stage').locator('canvas');
const count = async (page: Page, key: string): Promise<number> =>
    Number(await canvas(page).getAttribute(`data-particle-${key}`));

const pick = async (page: Page, tileId: string): Promise<void> => {
    const point = await page.evaluate((id) => {
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
    await page.mouse.click(point.x, point.y);
};

for (const reduced of [false, true]) {
    test.describe(reduced ? 'Reduced particle motion' : '4K card particles', () => {
        test.use({ viewport: reduced ? { width: 1280, height: 720 } : { width: 1920, height: 1080 },
            deviceScaleFactor: reduced ? 1 : 2 });
        test('bombs and card events render through a bounded shared pool', async ({ page }) => {
            test.setTimeout(300_000);
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
            });
            const save = JSON.parse(buildVisualSaveJson(true, reduced));
            save.settings.graphicsQuality = reduced ? 'low' : 'high';
            save.settings.masterVolume = 0;
            await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=bomb');
            await expect(page.getByTestId('tool-bomb')).toBeEnabled({ timeout: 150_000 });
            await expect.poll(() => count(page, 'active')).toBe(0);
            expect(await count(page, 'bomb-bursts')).toBe(0);
            await canvas(page).evaluate((node: HTMLCanvasElement) => {
                node.dataset.particleAllocationErrors = '[]';
                node.dataset.particleContextLosses = '0';
                const dpr = node.width / node.clientWidth;
                new MutationObserver(() => {
                    // HUD text can resize the stage; particle events must not change its DPR or pixel budget.
                    if (node.width * node.height > 3840 * 2160 || Math.abs(node.width / node.clientWidth - dpr) > 0.01) {
                        const errors = JSON.parse(node.dataset.particleAllocationErrors!);
                        errors.push({ width: node.width, height: node.height, cssWidth: node.clientWidth, dpr });
                        node.dataset.particleAllocationErrors = JSON.stringify(errors);
                    }
                }).observe(node, { attributes: true, attributeFilter: ['width', 'height'] });
                node.addEventListener('webglcontextlost', () => { node.dataset.particleContextLosses = '1'; });
                const capture = new MutationObserver(() => {
                    if (Number(node.dataset.particleActive) <= 0) return;
                    capture.disconnect();
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        (window as unknown as { __particleFrame: string }).__particleFrame = node.toDataURL();
                    }));
                });
                capture.observe(node, { attributes: true, attributeFilter: ['data-particle-active'] });
            });
            await page.getByTestId('tool-bomb').click();
            await expect(page.getByTestId('tool-bomb')).toHaveAttribute('aria-pressed', 'true');
            await pick(page, 'b-1');
            await expect.poll(() => count(page, 'bomb-bursts')).toBe(2);
            await expect.poll(() => count(page, 'peak')).toBeGreaterThan(0);
            const active = await count(page, 'peak');
            expect(active).toBeLessThanOrEqual(reduced ? 2 : 384);
            await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { __particleFrame?: string }).__particleFrame))).toBe(true);
            const particleFrame = await page.evaluate(() => (window as unknown as { __particleFrame: string }).__particleFrame);
            writeFileSync(`output/playwright/particles-burst-${reduced ? 'reduced' : '4k'}.png`, Buffer.from(particleFrame.split(',')[1]!, 'base64'));
            await page.screenshot({ path: `output/playwright/particles-bomb-${reduced ? 'reduced' : '4k'}.png` });
            await expect.poll(() => count(page, 'active')).toBe(0);
            const flips = await count(page, 'flip-bursts');
            await pick(page, 'a-1');
            await expect.poll(() => count(page, 'flip-bursts')).toBe(flips + (reduced ? 0 : 1));
            await pick(page, 'a-2');
            await expect.poll(() => count(page, 'match-bursts')).toBe(2);
            await page.screenshot({ path: `output/playwright/particles-match-${reduced ? 'reduced' : '4k'}.png` });
            await expect.poll(() => count(page, 'active')).toBe(0);
            expect(await canvas(page).getAttribute('data-particle-allocation-errors')).toBe('[]');
            expect(await canvas(page).getAttribute('data-particle-context-losses')).toBe('0');
            expect(await canvas(page).evaluate((node: HTMLCanvasElement) => node.width * node.height)).toBeLessThanOrEqual(3840 * 2160);
            if (!reduced) {
                await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=clean-pop');
                await expect(canvas(page)).toHaveAttribute('data-particle-budget', '384', { timeout: 150_000 });
                await pick(page, 'a-1');
                await pick(page, 'a-2');
                await expect.poll(() => count(page, 'chain-bursts')).toBeGreaterThan(0);
                await page.screenshot({ path: 'output/playwright/particles-chain-4k.png' });
                await expect.poll(() => count(page, 'active')).toBe(0);
            }
            expect(errors).toEqual([]);
        });
    });
}
