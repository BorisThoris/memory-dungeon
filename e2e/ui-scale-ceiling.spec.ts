import { expect, test, type Page } from '@playwright/test';
import { SCREEN_SCALE_CEILINGS, UI_SCALE_MAX } from '../src/renderer/uiScaleLimits';
import { describeFit } from './uiFit';
import {
    buildPopulatedProfileSaveJson,
    buildVisualSaveJson,
    gotoWithSave,
    mainMenuPlayButton
} from './visualScreenHelpers';

/**
 * How far the UI scale actually goes, per screen, in both directions.
 *
 * Xbox's accessibility guidelines ask for text scalable to 200% (`docs/RESEARCH_NOTES.md` §3) and
 * this game's slider stopped at 1.4, which looked like a gap of 0.6 until the fit contract was
 * read: **every one of its checks runs at `uiScale: 1`.** Gen 222 asked what the top of the range
 * does and found three things wrong with it - a slider whose top fifth applied nothing, a Settings
 * screen that lost its own Back and Save buttons above 1 (`100dvh` inside a `zoom`), and a main
 * menu that lost its meta frame from 1.1. The first two were fixed; the third set the cap at 1.05
 * and was blamed on a missing container-query rung in the menu.
 *
 * **Gen 227 re-measured and that blame was wrong.** Gen 223 had already refuted the rung story,
 * and the menu has since been rebuilt as a fluid page with no ladder to miss a rung from. Measured
 * with both caps lifted, the main menu holds to **1.6** - the most of the three - while **Profile
 * fails at 1.4**, and Profile is what the cap has actually been standing on all along.
 *
 * So this spec records a ceiling per screen and checks it **from both sides**:
 *
 * - at its ceiling the screen fits, which is what lets `UI_SCALE_MAX` be the smallest of them;
 * - at the next step above, the screen **must fail**. A ceiling nothing has been measured to break
 *   through is a ceiling nobody has checked, and the likely error is that it is too low - a
 *   screen quietly holding at 1.8 while its row says 1.4 costs players scaling they could have had.
 *   This is the negative control, and it is the assertion that will fail first when a layout is
 *   improved, which is the moment to raise that screen's row.
 *
 * Scales above the cap cannot be reached through the save (`SETTINGS_NUMERIC_RANGES` clamps it), so
 * they are applied as `--ui-scale` directly. That is deliberate: the question here is what the
 * layout does at that zoom, not what the app is willing to store.
 *
 * Same report as the fit contract, from the same function, so the two cannot drift. The board is
 * deliberately absent: it is a canvas that fits itself to its stage and has its own contract, and
 * what scales with `--ui-scale` is the chrome and the menus around it.
 */

const SCALE_VIEWPORTS = [
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'desktop', width: 1440, height: 900 }
] as const;

/** The probe ladder the ceilings were measured on; "above" is the next rung past a ceiling. */
const PROBE_LADDER = [1, UI_SCALE_MAX, 1.4, 1.6, 1.8, 2] as const;

const stepAbove = (ceiling: number): number => {
    const above = PROBE_LADDER.find((step) => step > ceiling);
    if (above === undefined) {
        throw new Error(`no probe step above ${ceiling}: the ladder cannot check this ceiling`);
    }
    return above;
};

const SCREENS = [
    { label: 'main menu', button: /^play$/i, ceiling: SCREEN_SCALE_CEILINGS['main menu'] },
    { label: 'settings', button: /^settings$/i, ceiling: SCREEN_SCALE_CEILINGS.settings },
    { label: 'profile', button: /^profile$/i, ceiling: SCREEN_SCALE_CEILINGS.profile }
] as const;

const atScale = (saveJson: string, uiScale: number): string => {
    const save = JSON.parse(saveJson) as { settings: Record<string, unknown> };
    save.settings = { ...save.settings, uiScale: Math.min(uiScale, UI_SCALE_MAX) };
    return JSON.stringify(save);
};

/**
 * Force the zoom past what the app will store. A stylesheet rule rather than an inline style,
 * because the app writes `--ui-scale` itself and a re-render would take an inline one back.
 */
const forceScale = async (page: Page, uiScale: number): Promise<void> => {
    await page.addStyleTag({ content: `[class*="content"] { --ui-scale: ${uiScale} !important; }` });
    await page.waitForTimeout(400);
};

const fitFailuresAtScale = async (
    page: Page,
    uiScale: number,
    viewport: { id: string; width: number; height: number },
    open: (page: Page) => Promise<void>
): Promise<string[]> => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await open(page);
    await forceScale(page, uiScale);
    await page.waitForTimeout(600);
    const report = await describeFit(page);
    return Object.entries(report).flatMap(([kind, rows]) => (rows as string[]).map((row) => `${kind}: ${row}`));
};

test.describe('the UI scale ceiling', () => {
    test.describe.configure({ retries: 0 });

    for (const { label, button, ceiling } of SCREENS) {
        test(`${label} holds its layout up to ${ceiling} and not past it`, async ({ page }) => {
            test.setTimeout(300_000);
            const base = label === 'profile' ? buildPopulatedProfileSaveJson(true) : buildVisualSaveJson(true);
            const open = async (target: Page, uiScale: number): Promise<void> => {
                await gotoWithSave(target, atScale(base, uiScale));
                await mainMenuPlayButton(target).waitFor({ state: 'visible', timeout: 30_000 });
                if (label !== 'main menu') {
                    await target.getByRole('button', { name: button }).click();
                    await target.waitForTimeout(500);
                }
            };

            const held = PROBE_LADDER.filter((step) => step <= ceiling);
            const failures: string[] = [];
            for (const uiScale of held) {
                for (const viewport of SCALE_VIEWPORTS) {
                    const rows = await fitFailuresAtScale(page, uiScale, viewport, (target) => open(target, uiScale));
                    console.log(
                        `SCALE ${label} @ ${viewport.id} x${uiScale}: ${rows.length === 0 ? 'fits' : rows.join(' | ')}`
                    );
                    failures.push(...rows.map((row) => `${label} @ ${viewport.id} x${uiScale} ${row}`));
                }
            }
            expect(failures, `${label}: fit failures at or under its recorded ceiling ${ceiling}`).toEqual([]);

            // The negative control: something must break above the ceiling, or the ceiling is too low.
            const above = stepAbove(ceiling);
            const breaks: string[] = [];
            for (const viewport of SCALE_VIEWPORTS) {
                const rows = await fitFailuresAtScale(page, above, viewport, (target) => open(target, above));
                console.log(
                    `SCALE ${label} @ ${viewport.id} x${above} (above the ceiling): ${rows.length === 0 ? 'fits' : rows.join(' | ')}`
                );
                breaks.push(...rows);
            }
            expect(
                breaks.length,
                `${label}: nothing breaks at ${above}, so the recorded ceiling of ${ceiling} is understated - raise it in SCREEN_SCALE_CEILINGS`
            ).toBeGreaterThan(0);
        });
    }

    test('a phone lays out at 1 whatever the stored scale says', async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoWithSave(page, atScale(buildVisualSaveJson(true), UI_SCALE_MAX));
        await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
        const applied = await page.evaluate(() => {
            const el = document.querySelector('[class*="content"]');
            return el ? getComputedStyle(el).getPropertyValue('--ui-scale').trim() : 'none';
        });
        expect(applied, 'a compact viewport lays out at 1, not at the stored scale').toBe('1');
        const report = await describeFit(page);
        expect(Object.values(report).flat(), 'phone at its own scale').toEqual([]);
    });
});
