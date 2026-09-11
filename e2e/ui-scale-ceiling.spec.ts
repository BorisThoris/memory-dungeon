import { expect, test, type Page } from '@playwright/test';
import { describeFit } from './uiFit';
import {
    buildPopulatedProfileSaveJson,
    buildVisualSaveJson,
    gotoWithSave,
    mainMenuPlayButton
} from './visualScreenHelpers';

/**
 * How far the UI scale actually goes.
 *
 * Xbox's accessibility guidelines ask for text scalable to 200% (`docs/RESEARCH_NOTES.md` §3) and
 * this game's slider stopped at 1.4, which looked like a gap of 0.6 until the fit contract was read:
 * **every one of its checks runs at `uiScale: 1`.** So nothing in this repository had ever asked
 * what the top of the range does, and three separate things were wrong with it.
 *
 * - **The slider's top fifth did nothing.** It ran to 1.4 while `App.tsx` capped what it applied at
 *   1.15, so dragging past that moved the handle and changed nothing on screen.
 * - **The Settings screen lost its own Back and Save buttons** at every scale above 1, on a Deck
 *   panel and a desktop identically. Its shell was `100dvh` tall inside a `zoom`, and a viewport
 *   unit does not zoom, so the shell ran past the bottom edge by exactly the scale. Fixed here
 *   (`--ui-zoomed-dvh`), and this spec is what proves it.
 * - **The main menu loses its meta frame from 1.1**, because its container-query ladder ends at
 *   `max-height: 760px` and there is no rung below it. That is a layout job with its own task; the
 *   cap is 1.05 until it lands, which is what `UI_SCALE_MAX` records.
 *
 * Same report as the fit contract, from the same function, so the two cannot drift. The board is
 * deliberately absent: it is a canvas that fits itself to its stage and has its own contract, and
 * what scales with `--ui-scale` is the chrome and the menus around it.
 */

const SCALE_VIEWPORTS = [
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'desktop', width: 1440, height: 900 },
    { id: 'phone', width: 390, height: 844 }
] as const;

const atScale = (saveJson: string, uiScale: number): string => {
    const save = JSON.parse(saveJson) as { settings: Record<string, unknown> };
    save.settings = { ...save.settings, uiScale };
    return JSON.stringify(save);
};

const fitFailuresAtScale = async (
    page: Page,
    uiScale: number,
    viewport: { id: string; width: number; height: number },
    open: (page: Page) => Promise<void>
): Promise<string[]> => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page);
    await page.waitForTimeout(600);
    const report = await describeFit(page);
    return Object.entries(report).flatMap(([kind, rows]) =>
        (rows as string[]).map((row) => `${kind}: ${row}`)
    );
};

test.describe('the UI scale ceiling', () => {
    test.describe.configure({ retries: 0 });

    const SCREENS = [
        ['main menu', /^play$/i],
        ['settings', /^settings$/i],
        ['profile', /^profile$/i]
    ] as const;

    for (const [label, button] of SCREENS) {
        test(`${label} holds its layout at the top of the scale range`, async ({ page }) => {
            test.setTimeout(300_000);
            const base = label === 'profile' ? buildPopulatedProfileSaveJson(true) : buildVisualSaveJson(true);
            const failures: string[] = [];
            // 0.8 and 1.05 are the slider's own ends; 1.4 and 2 are stored values the cap must hold down.
            for (const uiScale of [0.8, 1, 1.05, 1.4, 2]) {
                for (const viewport of SCALE_VIEWPORTS) {
                    const rows = await fitFailuresAtScale(page, uiScale, viewport, async (target) => {
                        await gotoWithSave(target, atScale(base, uiScale));
                        await mainMenuPlayButton(target).waitFor({ state: 'visible', timeout: 30_000 });
                        if (label !== 'main menu') {
                            await target.getByRole('button', { name: button }).click();
                            await target.waitForTimeout(500);
                        }
                    });
                    const applied = await page.evaluate(() => {
                        const el = document.querySelector('[class*="content"]');
                        return el ? getComputedStyle(el).getPropertyValue('--ui-scale').trim() : 'none';
                    });
                    console.log(
                        `SCALE ${label} @ ${viewport.id} x${uiScale} (applied ${applied}): ${rows.length === 0 ? 'fits' : rows.join(' | ')}`
                    );
                    failures.push(...rows.map((row) => `${label} @ ${viewport.id} x${uiScale} ${row}`));
                }
            }
            expect(failures, `${label}: fit failures across the scale range`).toEqual([]);
        });
    }
});
