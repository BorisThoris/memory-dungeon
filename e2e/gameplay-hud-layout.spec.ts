import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';

/**
 * Layout invariants for the gameplay shell.
 *
 * The floating overlays - the chain-opportunity chip, the trait-mode cue, the
 * action-feedback rail, the dungeon run strip - are absolutely positioned against the
 * stage by three different components, and each used to pick its own offset. They landed
 * on each other: the chip on the floor/par rail, the feedback rail over the score at a
 * higher z-index, the run strip inside the action dock. Separately, a collapsed `details`
 * whose children had an author `display` laid out its whole rail behind the board canvas,
 * eighteen panels below the fold, with its labels squeezed down to 7px.
 *
 * Nothing about those failures was visible to a unit test: every component rendered
 * correctly on its own. They only appear once the shell is laid out for real, which is
 * what this spec does.
 */

/**
 * The pinned @playwright/test wants a browser build that some sandboxes do not have.
 * Point this at a local Chromium to run the spec there; CI uses the configured browser.
 */
const localChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;
test.use(localChromium ? { launchOptions: { executablePath: localChromium } } : {});

/** Lanes a player has to read to make a decision. */
const MUST_READ_LANES = ['Floor', 'Par', 'Score'];

const startRun = async (page: import('@playwright/test').Page): Promise<void> => {
    await page.setViewportSize({ width: 1440, height: 900 });
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
        .waitFor({ state: 'visible', timeout: 60000 })
        .catch(() => undefined);
    await page.waitForTimeout(3000);
};

test.describe('gameplay HUD layout', () => {
    test('keeps the floating overlays off each other and inside the viewport', async ({ page }) => {
        await startRun(page);

        const report = await page.evaluate(() => {
            const box = (el: Element): DOMRect => el.getBoundingClientRect();
            const visible = Array.from(document.querySelectorAll('[data-testid]')).filter((el) => {
                const r = box(el);
                const cs = getComputedStyle(el);
                return (
                    r.width > 0 &&
                    r.height > 0 &&
                    cs.visibility !== 'hidden' &&
                    cs.opacity !== '0' &&
                    cs.display !== 'none'
                );
            });
            // A clipped child still reports its unclipped layout rect, so ask whether an
            // overflow ancestor already hides it before calling it a collision.
            const clipped = (el: Element): boolean => {
                const r = box(el);
                for (let n = el.parentElement; n; n = n.parentElement) {
                    const cs = getComputedStyle(n);
                    if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
                        const nr = box(n);
                        if (r.top >= nr.bottom || r.bottom <= nr.top || r.left >= nr.right || r.right <= nr.left) {
                            return true;
                        }
                    }
                }
                return false;
            };
            // Full-bleed stage containers overlap everything by construction.
            const candidates = visible.filter((el) => {
                const r = box(el);
                return r.width * r.height < window.innerWidth * window.innerHeight * 0.5;
            });
            const collisions: string[] = [];
            for (let i = 0; i < candidates.length; i++) {
                for (let j = i + 1; j < candidates.length; j++) {
                    const a = candidates[i];
                    const b = candidates[j];
                    if (a.contains(b) || b.contains(a) || clipped(a) || clipped(b)) {
                        continue;
                    }
                    const ra = box(a);
                    const rb = box(b);
                    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
                    const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
                    // A hairline shared border is not an overlap; a readable panel sitting
                    // on another one is.
                    if (w > 0 && h > 0 && w * h > 2500) {
                        collisions.push(`${a.getAttribute('data-testid')} over ${b.getAttribute('data-testid')}`);
                    }
                }
            }
            const offscreen = visible
                .filter((el) => {
                    const r = box(el);
                    return r.top > window.innerHeight || r.bottom < 0 || r.left > window.innerWidth || r.right < 0;
                })
                .map((el) => el.getAttribute('data-testid') ?? '');
            return { collisions, offscreen };
        });

        expect(report.collisions, 'panels overlapping each other').toEqual([]);
        expect(report.offscreen, 'panels laid out outside the viewport').toEqual([]);
    });

    test('renders the must-read HUD lanes at a legible size', async ({ page }) => {
        await startRun(page);

        const undersized = await page.evaluate((lanes: string[]) => {
            const wanted = new Set(lanes.map((lane) => lane.toLowerCase()));
            return Array.from(document.querySelectorAll('*'))
                .filter((el) => {
                    const r = el.getBoundingClientRect();
                    return (
                        el.children.length === 0 &&
                        r.width > 0 &&
                        r.height > 0 &&
                        wanted.has((el.textContent ?? '').trim().toLowerCase())
                    );
                })
                .map((el) => ({
                    text: (el.textContent ?? '').trim(),
                    fontSize: Number.parseFloat(getComputedStyle(el).fontSize)
                }))
                .filter((lane) => lane.fontSize < 12);
        }, MUST_READ_LANES);

        expect(undersized, 'must-read HUD lanes below 12px').toEqual([]);
    });

    test('reads a deep run\'s numbers without clipping them', async ({ page }) => {
        // Starting a run costs most of the default budget before this test does anything.
        test.setTimeout(180_000);
        /*
         * Gen 212. Every layout test here starts a fresh run, so the HUD had only ever been laid
         * out around the smallest numbers the game makes: a three-digit score on floor 1. The run
         * census (Gen 207) says a real run carries seven digits by floor 60 - measured, 1,605,856
         * after sixty floors at a 15% miss rate - and the score lane is a fixed `min-width` box
         * with `overflow: hidden` under it at small sizes. Nobody plays sixty floors in a browser
         * to find out, so the dev seam hands the shell the numbers.
         */
        await startRun(page);
        await page.evaluate(() => {
            const w = window as Window & {
                __memoryDungeonE2e?: { setRunProgress: (p: { totalScore: number; level: number; turnsThisFloor: number }) => void };
            };
            if (!w.__memoryDungeonE2e) {
                throw new Error('window.__memoryDungeonE2e missing; the deep-run HUD check requires Vite dev mode.');
            }
            w.__memoryDungeonE2e.setRunProgress({ totalScore: 1_605_856, level: 60, turnsThisFloor: 14 });
        });
        await expect(page.getByTestId('hud-score')).toContainText('1,605,856');

        for (const size of [
            { width: 1440, height: 900 },
            { width: 1280, height: 800 },
            { width: 960, height: 600 },
            // The Deck, and the narrowest layout the shell claims to support.
            { width: 1280, height: 720 },
            { width: 620, height: 900 }
        ]) {
            await page.setViewportSize(size);
            const clipped = await page.evaluate(() =>
                ['hud-score', 'hud-floor', 'hud-par']
                    .map((id) => {
                        const lane = document.querySelector(`[data-testid="${id}"]`);
                        if (!lane) return { id, missing: true, overflowBy: 0 };
                        // Every text node inside the lane has to fit the box it is painted in.
                        const worst = Array.from(lane.querySelectorAll('*'))
                            .concat([lane])
                            .filter((el) => el.children.length === 0)
                            .map((el) => el.scrollWidth - el.clientWidth)
                            .reduce((most, over) => Math.max(most, over), 0);
                        return { id, missing: false, overflowBy: worst };
                    })
                    .filter((lane) => lane.missing || lane.overflowBy > 1)
            );
            expect(clipped, `HUD lanes clipped at ${size.width}x${size.height}`).toEqual([]);
        }
    });
});
