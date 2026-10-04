import { expect, test } from '@playwright/test';
import { buildVisualSaveJson, gotoWithSaveAndQuery, expectNoHorizontalOverflow } from './visualScreenHelpers';

// Windows runs must use the noninteractive isolation launcher, even with headless Chromium.
test.use({ headless: true, launchOptions: { args: ['--mute-audio'] } });

test('arcane materials and mobile controls render without shader errors at every quality', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
    });
    const save = JSON.parse(buildVisualSaveJson(true, false));
    save.settings.masterVolume = 0;
    save.settings.graphicsQuality = 'high';
    save.settings.reduceMotion = false;
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoWithSaveAndQuery(page, JSON.stringify(save), 'hallRoom=bomb');
    const canvas = page.getByTestId('tile-board-stage').locator('canvas');
    await expect(canvas).toHaveAttribute('data-particle-budget', '640', { timeout: 120_000 });
    await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-shuffle-animating', 'false');

    for (const [name, width, height] of [['desktop', 1440, 900], ['phone', 390, 844], ['landscape', 844, 390]] as const) {
        await page.setViewportSize({ width, height });
        if (name !== 'desktop') {
            // Viewport state commits on the next animation frame; wait for the responsive
            // shell before measuring its controls, especially on an isolated software GPU.
            await expect(page.locator('[data-shell-layout]')).toHaveAttribute(
                'data-shell-layout', name === 'phone' ? 'phone-portrait' : 'phone-landscape'
            );
        }
        await expectNoHorizontalOverflow(page);
        const dock = page.getByTestId('game-action-dock');
        await expect(dock).toBeVisible();
        if (name !== 'desktop') {
            for (const button of await dock.getByRole('button').all()) {
                if (!(await button.isVisible())) continue;
                const bounds = await button.boundingBox();
                expect(bounds!.width).toBeGreaterThanOrEqual(44);
                expect(bounds!.height).toBeGreaterThanOrEqual(44);
                expect(bounds!.x).toBeGreaterThanOrEqual(0);
                expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
            }
        }
        await page.screenshot({ path: testInfo.outputPath(`arcane-${name}.png`) });
    }
    for (const [quality, budget] of [['medium', '320'], ['low', '128']] as const) {
        await page.evaluate(async (graphicsQuality) => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const state = useAppStore.getState();
            await state.updateSettings({ ...state.settings, graphicsQuality });
        }, quality);
        await expect(canvas).toHaveAttribute('data-particle-budget', budget);
    }
    expect(errors).toEqual([]);
});
