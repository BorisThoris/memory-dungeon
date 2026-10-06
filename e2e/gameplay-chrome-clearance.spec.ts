import { expect, test, type Page } from '@playwright/test';
import { SETTINGS_NUMERIC_RANGES } from '../src/shared/save-data';
import { dismissStartupIntro } from './startupIntroHelpers';
import { openPlayablePathFixture } from './playablePathHelpers';

/** The board canvas reaches every screen edge at every UI scale, beneath the floating HUD. */

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
    { id: 'desktop', width: 1440, height: 900 },
    { id: 'phone', width: 390, height: 844 },
    { id: 'landscape', width: 568, height: 320 }
] as const;

/**
 * Rounding the published clearance to whole layout px paints up to half a px out at scale 1, and
 * that much times the zoom above it. Two px is that, with room; eighteen is the defect above.
 */
const FLUSH_TOLERANCE_PX = 2;

/** The forced zoom has to land within this of what was asked, or the measurement means nothing. */
const ZOOM_TOLERANCE = 0.01;

/**
 * Dividing a painted rect by the measured zoom lands a fraction of a px out, so a box that exactly
 * contains its content reads as -0.27 at 0.8x. Half a px absorbs that; the defect this guards is
 * 136px of spill and 21px of overlap, which is nowhere near it.
 */
const SPILL_TOLERANCE_PX = 0.5;

interface ChromePlacement {
    readonly effectiveZoom: number;
    readonly stageTopMinusShellTop: number;
    readonly shellBottomMinusStageBottom: number;
    readonly horizontalEdgeError: number;
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
    await page.getByTestId('tile-board-stage-shell').waitFor({ state: 'visible', timeout: 60_000 });
    await page.waitForTimeout(3000);
};

/**
 * Applied as a stylesheet rule rather than through the save: the app clamps the stored value, and
 * the question here is what the layout does at a zoom, not what the app is willing to store.
 */
const forceScale = async (page: Page, uiScale: number): Promise<void> => {
    await page.addStyleTag({ content: `[class*="content"] { --ui-scale: ${uiScale} !important; }` });
    await expect.poll(() => page.evaluate(() => {
        const content = document.querySelector<HTMLElement>('[class*="content"]')!;
        return content.getBoundingClientRect().width / content.clientWidth;
    })).toBeCloseTo(uiScale, 2);
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
        const shell = find('[data-testid="run-shell"]').getBoundingClientRect();
        return {
            effectiveZoom: content.getBoundingClientRect().width / content.clientWidth,
            stageTopMinusShellTop: stage.top - shell.top,
            shellBottomMinusStageBottom: shell.bottom - stage.bottom,
            horizontalEdgeError: Math.max(Math.abs(stage.left - shell.left), Math.abs(stage.right - shell.right))
        };
    });

test.describe('the in-run chrome clearance', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of VIEWPORTS) {
        test(`the board canvas fills the screen at every scale on ${viewport.id}`, async ({ page }) => {
            test.setTimeout(300_000);
            await startRun(page, viewport.width, viewport.height);

            const failures: string[] = [];
            // Compact gameplay intentionally fixes UI scale at 1 for touch target sizing.
            for (const uiScale of viewport.width < 760 ? [1] : PROBE_SCALES) {
                await forceScale(page, uiScale);
                const placement = await readChromePlacement(page);
                const at = `${viewport.id} x${uiScale}`;
                console.log(
                    `CLEARANCE ${at}: zoom ${placement.effectiveZoom.toFixed(3)}, ` +
                        `stage-top ${placement.stageTopMinusShellTop.toFixed(2)}, ` +
                        `stage-bottom ${placement.shellBottomMinusStageBottom.toFixed(2)}`
                );
                if (Math.abs(placement.effectiveZoom - uiScale) > ZOOM_TOLERANCE) {
                    failures.push(
                        `${at}: the forced scale did not take (measured ${placement.effectiveZoom.toFixed(3)}), ` +
                            'so nothing here was measured at that scale'
                    );
                }
                if (Math.abs(placement.stageTopMinusShellTop) > FLUSH_TOLERANCE_PX) {
                    failures.push(
                        `${at}: the board stage begins ${placement.stageTopMinusShellTop.toFixed(2)}px from where ` +
                            'the screen begins'
                    );
                }
                if (Math.abs(placement.shellBottomMinusStageBottom) > FLUSH_TOLERANCE_PX) {
                    failures.push(
                        `${at}: the board stage ends ${placement.shellBottomMinusStageBottom.toFixed(2)}px from where ` +
                            'the screen ends'
                    );
                }
                if (placement.horizontalEdgeError > FLUSH_TOLERANCE_PX) {
                    failures.push(`${at}: canvas is inset ${placement.horizontalEdgeError}px from a side of the screen`);
                }
            }
            expect(failures, `${viewport.id}: the canvas does not fill the screen`).toEqual([]);
        });
    }

    test('rotation rearranges the grid and refits every card clear of the chrome', async ({ page }) => {
        test.setTimeout(180_000);
        await startRun(page, 390, 844);
        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute('data-board-columns', '2');
        for (const viewport of [{ width: 568, height: 320 }, { width: 1280, height: 800 }, { width: 320, height: 568 }]) {
            await page.setViewportSize(viewport);
            await expect(frame).toHaveAttribute('data-board-zoom', '1.0000');
            await expect.poll(() => page.evaluate(() => {
                const frame = document.querySelector<HTMLElement>('[data-testid="tile-board-frame"]')!;
                const hud = document.querySelector('[data-testid="game-hud"]')!.getBoundingClientRect();
                const dock = document.querySelector('[data-testid="game-action-dock"]')!.getBoundingClientRect();
                const rail = document.querySelector('[data-testid="hud-chain"]')!.getBoundingClientRect();
                const left = rail.bottom > hud.bottom + 1 && rail.width > 0 && rail.width < innerWidth / 2 ? rail.right : 0;
                const hooks = window as Window & {
                    __e2eGetTileIdAtGrid1?: (row: number, col: number) => string | null;
                    __e2eGetTileClientRectAtGrid1?: (row: number, col: number) => DOMRect | null;
                };
                if (!hooks.__e2eGetTileClientRectAtGrid1 || !hooks.__e2eGetTileIdAtGrid1) return ['missing board hooks'];
                const errors: string[] = [];
                let cards = 0;
                for (let row = 1; row <= Number(frame.dataset.boardRows); row++) {
                    for (let col = 1; col <= Number(frame.dataset.boardColumns); col++) {
                        if (!hooks.__e2eGetTileIdAtGrid1(row, col)) continue;
                        cards++;
                        const rect = hooks.__e2eGetTileClientRectAtGrid1(row, col);
                        if (!rect || rect.left < left - 2 || rect.right > innerWidth || rect.top < hud.bottom - 2 || rect.bottom > dock.top + 2) errors.push(`${row},${col}`);
                    }
                }
                return cards === 8 ? errors : ['not the complete opening board'];
            }), { timeout: 15_000 }).toEqual([]);
        }
        await expect(frame).toHaveAttribute('data-board-columns', '2');
    });

    /**
     * The floor-clear beat and the chain read are two live surfaces in the same strip.
     *
     * #250 reported the rail drawn over the beat at 1.1, and it was: Gen 240 measured the beat's
     * title starting 21px inside a read that ends at 408. What made that unreachable was the cap
     * coming down to 1.05 in Gen 238 - not anything about this pair. Re-measured at the scales the
     * slider actually offers, on a 1280x800 Deck panel, the title cleared the read by 37px at 1.0,
     * 21px at 1.025 and **6px at 1.05**. Six px is not clearance, it is a coincidence that survived
     * a cap change.
     *
     * So the pair is held apart here, at every scale `SETTINGS_NUMERIC_RANGES` allows, and the
     * chain box is required to contain its own read - the thing that was actually wrong, and what
     * made the beat's inset a lie: the box declared 13rem while its content painted to 21.5rem, so
     * anything positioned against it was off by 136px (Gen 257).
     *
     * The negative control is the scale this started at. 1.1 is past the cap, so it is forced
     * directly rather than stored, and the same assertion has to report the overlap Gen 240 found -
     * a bar that only ever sees passing geometry is a bar nobody has checked.
     */
    test('the floor-clear beat and the chain read never meet', async ({ page }) => {
        test.setTimeout(300_000);
        await page.setViewportSize({ width: 1280, height: 800 });

        const failures: string[] = [];
        /*
         * Arrive again for every scale. The beat is a transient surface: it plays and goes, so a
         * loop that opens the fixture once and re-zooms measures it at the first scale and finds
         * nothing at the rest - which is what this test did on its first run, reporting `surfaces
         * missing` at 1.0 and 1.05. Gen 239 recorded the same artefact on the same screen.
         */
        const overlapAtScale = async (uiScale: number): Promise<{ titleGap: number; boxSpill: number } | null> => {
            await openPlayablePathFixture(page, 'floorClearWithRouteChoices');
            await forceScale(page, uiScale);
            await page.waitForTimeout(400);
            return page.evaluate(() => {
                const shell = document.querySelector('[data-testid="run-shell"]');
                const zoom = shell ? shell.getBoundingClientRect().width / Math.max(1, shell.clientWidth) : 1;
                const chain = document.querySelector('[data-testid="hud-chain"]');
                const read = document.querySelector('[data-testid="hud-chain-rung-value"]')?.parentElement ?? null;
                const title = document.querySelector('[data-testid="floor-clear-title"]');
                if (!chain || !read || !title) {
                    return null;
                }
                const layout = (el: Element) => {
                    const r = el.getBoundingClientRect();
                    return { left: r.left / zoom, right: r.right / zoom };
                };
                const readBox = layout(read);
                const chainBox = layout(chain);
                const titleBox = layout(title);
                /*
                 * Two numbers, not their minimum. Collapsing them with `Math.min` passed and read
                 * `-0.33px` at every scale, because the box exactly contains its read and that term
                 * always won - so the log said nothing about the margin the test is named for,
                 * which is the 37 / 21 / 6px series. A check that cannot be read is a check nobody
                 * will read.
                 */
                return { titleGap: titleBox.left - readBox.right, boxSpill: chainBox.right - readBox.right };
            });
        };

        for (const uiScale of PROBE_SCALES) {
            const measured = await overlapAtScale(uiScale);
            console.log(
                `BEAT x${uiScale}: ${
                    measured === null
                        ? 'surfaces missing'
                        : `title clears read by ${measured.titleGap.toFixed(2)}px, box spill ${measured.boxSpill.toFixed(2)}px`
                }`
            );
            if (measured === null) {
                failures.push(`x${uiScale}: the beat, the chain or its read was not on screen, so nothing was measured`);
                continue;
            }
            if (measured.titleGap < -SPILL_TOLERANCE_PX) {
                failures.push(
                    `x${uiScale}: the floor-clear title starts ${Math.abs(measured.titleGap).toFixed(2)}px inside the chain read`
                );
            }
            if (measured.boxSpill < -SPILL_TOLERANCE_PX) {
                failures.push(
                    `x${uiScale}: the chain read spills ${Math.abs(measured.boxSpill).toFixed(2)}px past the box that declares it`
                );
            }
        }
        expect(failures, 'the floor-clear beat and the chain read share the strip').toEqual([]);

        // The control: past the cap this pair is known to collide, so the check has to say so.
        const pastCap = await overlapAtScale(1.1);
        expect(pastCap, 'the probe measured nothing at the control scale').not.toBeNull();
        console.log(`BEAT control x1.1: title clears read by ${(pastCap?.titleGap ?? 0).toFixed(2)}px`);
        expect(
            pastCap?.titleGap ?? 0,
            'at 1.1 - past the shipped cap - Gen 240 measured the beat 21px inside the read; a check that ' +
                'cannot see that is not measuring this pair'
        ).toBeLessThan(-SPILL_TOLERANCE_PX);
    });
});
