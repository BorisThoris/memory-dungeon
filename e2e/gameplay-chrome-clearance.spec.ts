import { expect, test, type Page } from '@playwright/test';
import { SETTINGS_NUMERIC_RANGES } from '../src/shared/save-data';
import { dismissStartupIntro } from './startupIntroHelpers';

/**
 * The board stage starts where the HUD ends, at every scale the slider offers.
 *
 * `useGameplayChromeClearance` measures the two fixed bars and publishes their spans as
 * `--gameplay-hud-top-clearance` / `--gameplay-dock-bottom-clearance`; the stage insets itself by
 * exactly those, so the cards never print under the score. That is checkable by looking at the
 * painted result, and until Gen 237 nothing looked.
 *
 * What it measured: the spans come off `getBoundingClientRect()`, which reports the PAINTED box,
 * and were written back as CSS lengths, which the same subtree reads as LAYOUT px. The UI scale is
 * a `zoom` on the shell, so those two units differ by exactly the scale. At scale 1 they agree -
 * and scale 1 is what every other check in this repository pins, which is why the fault survived.
 * On a 1280x800 Deck panel and a 1440x900 desktop, same run on screen:
 *
 *   scale   HUD layout span   published   stage top - HUD bottom
 *   0.8     118.4             95px        -18.7   board under the bar
 *   1       118.4             118px        -0.4   flush
 *   1.1     118.4             130px       +12.8   dead strip
 *
 * So this spec checks the painted result rather than the property: wherever the stage means to
 * begin below the chrome, it has to begin where the chrome actually ends. It runs at the bottom,
 * the middle and the top of the slider's own travel, taken from `SETTINGS_NUMERIC_RANGES`, so
 * widening that range widens this check with it.
 *
 * The negative control is the third assertion: the spec only means anything if the zoom it forces
 * actually takes. A probe that silently applies nothing reports three identical measurements at
 * scale 1 and passes - which is how the Gen 222 scale ceiling was measured wrong, against a second
 * clamp nobody had noticed. So the measured zoom has to match the scale asked for, and the whole
 * sweep is collected and asserted once rather than stopping at the first window that fails.
 */

const localChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;
test.use(localChromium ? { launchOptions: { executablePath: localChromium } } : {});

/** Where the slider actually goes, plus the middle: a scale nothing checks is a scale that breaks. */
const PROBE_SCALES = [
    SETTINGS_NUMERIC_RANGES.uiScale.min,
    1,
    SETTINGS_NUMERIC_RANGES.uiScale.max
] as const;

const VIEWPORTS = [
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'desktop', width: 1440, height: 900 }
] as const;

/**
 * Rounding the published clearance to whole layout px paints up to half a px out at scale 1, and
 * that much times the zoom above it. Two px is that, with room; eighteen is the defect above.
 */
const FLUSH_TOLERANCE_PX = 2;

/** The forced zoom has to land within this of what was asked, or the measurement means nothing. */
const ZOOM_TOLERANCE = 0.01;

interface ChromePlacement {
    readonly effectiveZoom: number;
    readonly stageTopMinusHudBottom: number;
    readonly dockTopMinusStageBottom: number;
}

const startRun = async (page: Page, width: number, height: number): Promise<void> => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await dismissStartupIntro(page);
    await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible();
    const dismiss = page.getByRole('button', { name: /^dismiss$/i });
    if (await dismiss.isVisible().catch(() => false)) {
        await dismiss.click();
    }
    await page.getByRole('button', { name: /^play$/i }).click();
    await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    await page.locator('button', { hasText: /start run/i }).first().click();
    await page
        .getByRole('heading', { name: /level 1/i })
        .waitFor({ state: 'visible', timeout: 60_000 })
        .catch(() => undefined);
    await page.waitForTimeout(3000);
};

/**
 * Applied as a stylesheet rule rather than through the save: the app clamps the stored value, and
 * the question here is what the layout does at a zoom, not what the app is willing to store.
 */
const forceScale = async (page: Page, uiScale: number): Promise<void> => {
    await page.addStyleTag({ content: `[class*="content"] { --ui-scale: ${uiScale} !important; }` });
    await page.waitForTimeout(900);
};

const readChromePlacement = async (page: Page): Promise<ChromePlacement> =>
    page.evaluate(() => {
        const find = (selector: string): HTMLElement => {
            const el = document.querySelector<HTMLElement>(selector);
            if (!el) {
                throw new Error(`the in-run shell is missing ${selector}`);
            }
            return el;
        };
        const content = find('[class*="content"]');
        const stage = find('[data-testid="board-stage"]').getBoundingClientRect();
        const hud = find('[data-testid="game-hud"]').getBoundingClientRect();
        const dock = find('[data-testid="game-action-dock"]').getBoundingClientRect();
        return {
            effectiveZoom: content.getBoundingClientRect().width / content.clientWidth,
            stageTopMinusHudBottom: stage.top - hud.bottom,
            dockTopMinusStageBottom: dock.top - stage.bottom
        };
    });

test.describe('the in-run chrome clearance', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of VIEWPORTS) {
        test(`the board stage meets the chrome at every scale on ${viewport.id}`, async ({ page }) => {
            test.setTimeout(300_000);
            await startRun(page, viewport.width, viewport.height);

            const failures: string[] = [];
            for (const uiScale of PROBE_SCALES) {
                await forceScale(page, uiScale);
                const placement = await readChromePlacement(page);
                const at = `${viewport.id} x${uiScale}`;
                console.log(
                    `CLEARANCE ${at}: zoom ${placement.effectiveZoom.toFixed(3)}, ` +
                        `stage-hud ${placement.stageTopMinusHudBottom.toFixed(2)}, ` +
                        `dock-stage ${placement.dockTopMinusStageBottom.toFixed(2)}`
                );
                if (Math.abs(placement.effectiveZoom - uiScale) > ZOOM_TOLERANCE) {
                    failures.push(
                        `${at}: the forced scale did not take (measured ${placement.effectiveZoom.toFixed(3)}), ` +
                            'so nothing here was measured at that scale'
                    );
                }
                if (Math.abs(placement.stageTopMinusHudBottom) > FLUSH_TOLERANCE_PX) {
                    failures.push(
                        `${at}: the board stage begins ${placement.stageTopMinusHudBottom.toFixed(2)}px from where ` +
                            'the HUD ends (negative means the cards print under the bar)'
                    );
                }
                if (Math.abs(placement.dockTopMinusStageBottom) > FLUSH_TOLERANCE_PX) {
                    failures.push(
                        `${at}: the board stage ends ${placement.dockTopMinusStageBottom.toFixed(2)}px from where ` +
                            'the action dock begins (negative means the cards print under the dock)'
                    );
                }
            }
            expect(failures, `${viewport.id}: the stage and the chrome do not meet`).toEqual([]);
        });
    }
});
