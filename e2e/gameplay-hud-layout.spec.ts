import { expect, test } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';

/**
 * Layout invariants for the gameplay shell.
 *
 * The floating overlays - the chain-opportunity chip, the trait-mode cue, the
 * action-feedback rail, the dungeon run strip - are absolutely positioned against the
 * stage by three different components, and each used to pick its own offset. They landed
 * on each other: the chip on the floor/lives rail, the feedback rail over the score at a
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
const MUST_READ_LANES = ['Floor', 'Lives', 'Shards', 'Score'];

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
});
