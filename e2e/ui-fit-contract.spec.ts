import { expect, test, type Page } from '@playwright/test';
import { openModeDetail, openPlayablePathFixture, openRunMenuItem } from './playablePathHelpers';
import { findUnreachableControls } from './uiReachability';
import { dismissStartupIntro } from './startupIntroHelpers';
import {
    buildPopulatedProfileSaveJson,
    buildVisualSaveJson,
    gotoWithSave,
    mainMenuPlayButton,
    openLevel1Play,
    waitLevel1PlayReady
} from './visualScreenHelpers';

/**
 * The fit contract: every screen states what it has to say inside the window it is given.
 *
 * Three ways a screen can break that, all of them things this project has shipped before:
 * a scrollbar (the page grew instead of adapting), text below the 12px floor (it shrank
 * instead of adapting), and text cut off behind an ellipsis or a clamp (it hid what it had
 * to say). A panel laid out past the bottom edge is the fourth: content that exists but
 * cannot be reached, which is worse than a scrollbar rather than better than one.
 */

const VIEWPORTS = [
    { id: 'desktop', width: 1440, height: 900 },
    // The Steam Deck's native panel. Every screen has to fit it for Deck Verified, and it is the
    // one size in this list that a launch checklist names outright.
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'laptop', width: 1024, height: 768 },
    { id: 'tablet', width: 834, height: 1112 },
    { id: 'phone', width: 390, height: 844 },
    { id: 'landscape', width: 812, height: 375 }
] as const;

interface FitReport {
    scrollers: string[];
    undersized: string[];
    clipped: string[];
    belowFold: string[];
    /** Visible text whose centre another element paints over: a line under a sticky actions bar. */
    covered: string[];
    /** Visible text leaves whose boxes intersect: two dock labels run together. */
    overlapping: string[];
}

const describeFit = async (page: Page): Promise<FitReport> =>
    page.evaluate(() => {
        // Screen-reader-only text is clipped on purpose and parked outside the window; it is
        // not something a player can see, so it is not something that can fail to fit.
        const srOnly = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
                cs.clipPath !== 'none' ||
                cs.clip !== 'auto' ||
                r.width <= 1 ||
                r.height <= 1 ||
                r.bottom <= 0 ||
                r.right <= 0 ||
                r.left >= window.innerWidth
            );
        };
        const shown = (el: Element): boolean => {
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return (
                r.width > 0 &&
                r.height > 0 &&
                cs.visibility !== 'hidden' &&
                cs.display !== 'none' &&
                cs.opacity !== '0' &&
                !srOnly(el)
            );
        };
        const name = (el: Element): string => {
            const testId = el.getAttribute('data-testid');
            const text = (el.textContent ?? '').trim().slice(0, 32);
            return testId ? `[${testId}] ${text}` : `${el.tagName.toLowerCase()} ${text}`;
        };
        const all = Array.from(document.querySelectorAll('*'));
        const leaves = all.filter((el) => el.children.length === 0 && (el.textContent ?? '').trim().length > 0 && shown(el));
        // What a leaf actually shows: its box cut down by every clipping ancestor. A card whose
        // meta line runs past its clipped cell is clipped, not overlapping the pager below it.
        const visibleRect = (el: Element): DOMRect => {
            let r = el.getBoundingClientRect();
            let node: Element | null = el.parentElement;
            while (node && node !== document.body) {
                const cs = getComputedStyle(node);
                if (/hidden|clip/.test(`${cs.overflowX}${cs.overflowY}`)) {
                    const c = node.getBoundingClientRect();
                    const left = Math.max(r.left, c.left);
                    const top = Math.max(r.top, c.top);
                    const right = Math.min(r.right, c.right);
                    const bottom = Math.min(r.bottom, c.bottom);
                    r = new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
                }
                node = node.parentElement;
            }
            return r;
        };

        const scrollers = all
            .filter((el) => {
                const cs = getComputedStyle(el);
                return (
                    (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) &&
                    /auto|scroll/.test(`${cs.overflowY}${cs.overflowX}`)
                );
            })
            .map(name);

        const undersized = leaves.filter((el) => Number.parseFloat(getComputedStyle(el).fontSize) < 12).map(name);

        // Text the layout is hiding: clamped to fewer lines than it has, cut horizontally, or cut
        // by a clipping ancestor - a card's third line under its cell's edge on a phone sideways.
        const clipped = leaves
            .filter((el) => {
                const cs = getComputedStyle(el);
                const clampedLines = Number.parseInt(cs.webkitLineClamp, 10);
                const clampCuts = Number.isFinite(clampedLines) && el.scrollHeight > el.clientHeight + 2;
                const ellipsisCuts = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 2;
                const hiddenCuts = cs.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 4;
                if (el.closest('[aria-hidden="true"], [inert]')) return clampCuts || ellipsisCuts || hiddenCuts;
                const own = el.getBoundingClientRect();
                const seen = visibleRect(el);
                const ancestorCuts = own.height > 0 && seen.height < own.height - 4;
                return clampCuts || ellipsisCuts || hiddenCuts || ancestorCuts;
            })
            .map(name);

        // Anything laid out past the bottom edge with nothing to scroll it into view. Text
        // leaves count, not just panels: a stat tile with no test id is just as unreadable.
        const belowFold = [...new Set([...leaves, ...all.filter((el) => el.getAttribute('data-testid') && shown(el))])]
            .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.bottom > window.innerHeight + 8 && r.height < window.innerHeight;
            })
            .map(name);

        // Text another element paints over. The dialog actions are sticky and the third door's
        // risk line slid under them on a phone: inside the window, not clipped, unreadable.
        const covered = leaves
            .filter((el) => {
                const r = visibleRect(el);
                if (r.width <= 0 || r.height <= 0) return false;
                const x = r.left + r.width / 2;
                const y = r.top + r.height / 2;
                if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;
                const top = document.elementFromPoint(x, y);
                if (!top) return false;
                if (top === el || el.contains(top) || top.contains(el)) return false;
                // A dialog over the screen is meant to cover it: the HUD under a floor-clear
                // scrim is not a defect, and the background is inert or aria-hidden while it shows.
                if (el.closest('[aria-hidden="true"], [inert]')) return false;
                if (top.closest('[role="dialog"]') || top.querySelector('[role="dialog"]')) return false;
                // Transparent overlays (hit layers, a card's full-face button with screen-reader
                // text, tooltips' invisible anchors) do not cover text: a cover paints a background
                // or shows text of its own.
                const cs = getComputedStyle(top);
                const showsText =
                    (top.children.length === 0 && (top.textContent ?? '').trim().length > 0 && shown(top)) ||
                    Array.from(top.querySelectorAll('*')).some(
                        (d) => d.children.length === 0 && (d.textContent ?? '').trim().length > 0 && shown(d)
                    );
                const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || showsText;
                if (!paints) return false;
                // A label and its number share a few pixels of leading by design; a cover is the
                // other element's box taking more than half the line's height.
                const t = top.getBoundingClientRect();
                const overlapY = Math.min(r.bottom, t.bottom) - Math.max(r.top, t.top);
                return overlapY > r.height * 0.5;
            })
            .map(name);

        // Two text leaves sharing pixels: a row of labels with less width than the words. Only
        // within one layer: the HUD under a dialog's scrim is covered on purpose, not overlapped.
        const overlapping: string[] = [];
        const rects = leaves
            .filter((el) => !el.closest('[aria-hidden="true"], [inert]'))
            .map((el) => ({ el, r: visibleRect(el), layer: el.closest('[role="dialog"]') }))
            .filter(({ r }) => r.width > 0 && r.height > 0);
        for (let i = 0; i < rects.length; i += 1) {
            for (let j = i + 1; j < rects.length; j += 1) {
                const a = rects[i]!;
                const b = rects[j]!;
                if (a.layer !== b.layer) continue;
                if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
                const overlapX = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
                const overlapY = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
                // Words on one line running into each other: a real horizontal overlap across
                // most of the line's height. Stacked text sharing leading is not that.
                const minHeight = Math.min(a.r.height, b.r.height);
                if (overlapX > 4 && overlapY > minHeight * 0.5) {
                    overlapping.push(`${name(a.el)} × ${name(b.el)}`);
                }
            }
        }

        return { scrollers, undersized, clipped, belowFold, covered, overlapping };
    });

const expectFits = async (page: Page, label: string, viewport: string): Promise<void> => {
    const report = { ...(await describeFit(page)), unreachable: await findUnreachableControls(page) };
    const summary = `${label} @ ${viewport}`;
    // Name what broke before asserting, so a CI log says which element on which screen.
    for (const [kind, rows] of Object.entries(report)) {
        if (rows.length > 0) {
            console.log(`FIT ${summary} | ${kind}: ${rows.join(' | ')}`);
        }
    }
    expect(report.scrollers, `${summary}: scrollbars`).toEqual([]);
    expect(report.undersized, `${summary}: text below the 12px floor`).toEqual([]);
    expect(report.clipped, `${summary}: text cut off instead of laid out`).toEqual([]);
    expect(report.belowFold, `${summary}: panels past the bottom edge`).toEqual([]);
    expect(report.covered, `${summary}: text another element paints over`).toEqual([]);
    expect(report.overlapping, `${summary}: text leaves that share pixels`).toEqual([]);
    expect(report.unreachable, `${summary}: controls a click cannot reach`).toEqual([]);
};

/**
 * `arrive` runs once per viewport for screens a navigation can reach cheaply. `settle` runs
 * after each resize for surfaces that cost a whole 3D run to reach: the run starts once and
 * the window changes around it, which is also closer to what a player does when they turn
 * their phone mid-run.
 */
const atEverySize = async (
    page: Page,
    label: string,
    arrive: () => Promise<void>,
    settle?: () => Promise<void>
): Promise<void> => {
    if (settle) {
        await arrive();
    }
    for (const viewport of VIEWPORTS) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        if (settle) {
            await settle();
        } else {
            await arrive();
        }
        await page.waitForTimeout(700);
        await expectFits(page, label, viewport.id);
    }
};

test.describe('UI fit contract', () => {
    test.describe.configure({ retries: 0 });

    // One test per screen: each gets its own page, so a long sweep cannot pile five
    // viewports' worth of 3D board contexts into a single browser session.
    const MENU_SCREENS = [
        ['collection', /^collection$/i],
        ['profile', /^profile$/i],
        ['inventory', /^inventory$/i],
        ['codex', /^codex$/i],
        ['settings', /^settings$/i]
    ] as const;

    test('main menu fits every window', async ({ page }) => {
        test.setTimeout(300_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(page, 'main menu', async () => {
            await gotoWithSave(page, save);
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
        });
    });

    for (const [label, button] of MENU_SCREENS) {
        test(`${label} fits every window`, async ({ page }) => {
            test.setTimeout(300_000);
            // Profile grows with play: a full run history and a record per mode. Checking it on a
            // save that has never finished a run only proves the empty state fits.
            const save = label === 'profile' ? buildPopulatedProfileSaveJson(true) : buildVisualSaveJson(true);
            await atEverySize(page, label, async () => {
                await gotoWithSave(page, save);
                await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
                await page.getByRole('button', { name: button }).click();
                await page.waitForTimeout(500);
            });
        });
    }

    test('choose your path fits every window', async ({ page }) => {
        test.setTimeout(300_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(page, 'choose your path', async () => {
            await gotoWithSave(page, save);
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            await mainMenuPlayButton(page).click();
            await page.waitForTimeout(800);
        });
    });

    test('the board fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        await atEverySize(
            page,
            'gameplay',
            async () => {
                await openLevel1Play(page);
                await waitLevel1PlayReady(page);
            },
            async () => {
                await page.waitForTimeout(600);
            }
        );
    });

    for (const [label, arrive] of [
        ['pause', async (page: Page) => {
            await page.keyboard.press('p');
        }],
        ['shortcuts', async (page: Page) => {
            await page.keyboard.press('F1');
        }]
    ] as const) {
        test(`${label} fits every window`, async ({ page }) => {
            test.setTimeout(420_000);
            await atEverySize(
                page,
                label,
                async () => {
                    await openLevel1Play(page);
                    await waitLevel1PlayReady(page);
                },
                async () => {
                    await arrive(page);
                    await page.waitForTimeout(400);
                }
            );
        });
    }

    for (const item of ['inventory', 'codex', 'settings'] as const) {
        test(`in-run ${item} fits every window`, async ({ page }) => {
            test.setTimeout(420_000);
            await atEverySize(
                page,
                `in-run ${item}`,
                async () => {
                    await openLevel1Play(page);
                    await waitLevel1PlayReady(page);
                },
                async () => {
                    const surfaceTestId =
                        item === 'settings' ? 'settings-shell-panel' : item === 'inventory' ? 'inventory-meta-frame-run' : 'codex-screen';
                    const surface = page.getByTestId(surfaceTestId);
                    if (!(await surface.isVisible().catch(() => false))) {
                        await openRunMenuItem(page, item);
                    }
                    await page.waitForTimeout(500);
                }
            );
        });
    }

    // The vendor, the mode detail sheet and the showcase are surfaces a run passes through
    // without a fixture of their own; they are held to the same contract.
    test('the vendor fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        await atEverySize(
            page,
            'shop',
            async () => {
                await openPlayablePathFixture(page, 'floorClearWithShop');
            },
            async () => {
                const shop = page.getByTestId('shop-screen');
                if (!(await shop.isVisible().catch(() => false))) {
                    await page
                        .getByRole('dialog', { name: /floor cleared/i })
                        .getByRole('button', { name: /visit shop/i })
                        .click({ force: true });
                    await shop.waitFor({ state: 'visible', timeout: 20_000 });
                }
                await page.waitForTimeout(500);
            }
        );
    });

    /*
     * Four seats is the crowded case for the run bar: it is the widest the HUD ever gets, and it
     * broke at 812x375 the first time it was measured — the full seat names pushed the stat row
     * past the right edge and took the mutator chip with them. Held to the contract at every size,
     * because a shared game is played on whatever is on the table.
     */
    test('a four-seat run bar fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(
            page,
            'pass and play',
            async () => {
                await gotoWithSave(page, save);
                await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
                await mainMenuPlayButton(page).click();
                await page.waitForTimeout(800);
                // Filter rather than hunt: the browse grid is paged to fit, and on a phone that is
                // one card per page out of thirteen.
                await page.getByRole('searchbox', { name: /filter modes/i }).fill('Pass and Play');
                await page.waitForTimeout(500);
                await page.getByRole('button', { name: /pass and play/i }).first().click();
                const detail = page.getByRole('dialog', { name: /pass and play/i });
                await detail.waitFor({ state: 'visible', timeout: 20_000 });
                await detail.getByRole('button', { name: /^4 players$/i }).click();
                await page.getByTestId('run-shell').waitFor({ state: 'visible', timeout: 30_000 });
                await page.waitForTimeout(1200);
            },
            async () => {
                await page.waitForTimeout(700);
            }
        );
    });

    test('the mode detail sheet fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(page, 'mode detail', async () => {
            await gotoWithSave(page, save);
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            // Classic is the recommended run and sits on the launch panel, which has a setup door
            // rather than a detail sheet; the sheet belongs to the library cards, so open one of those.
            await openModeDetail(page, 'Puzzle');
            await page.waitForTimeout(500);
        });
    });

    /*
     * Gen 111 retired the Dungeon Showcase card: it was Classic on a staged board with records off,
     * and that became the setup sheet's "do not record" option. This case used to click a
     * main-menu button of that name, which no longer exists, and timed out at every size reading
     * as a load problem rather than a stale locator. The sheet is the surface that replaced it,
     * and it is a real dialog with two vows, a clock, a pace, a joker and a record toggle, so it
     * is the one that has to fit.
     */
    test('the run setup sheet fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(page, 'run setup sheet', async () => {
            await gotoWithSave(page, save);
            await dismissStartupIntro(page);
            await mainMenuPlayButton(page).click({ force: true });
            const launch = page.getByRole('region', { name: /recommended run/i });
            await expect(launch).toBeVisible({ timeout: 15_000 });
            await launch.getByRole('button', { name: /^set up your run$/i }).click({ force: true });
            await expect(page.getByRole('dialog', { name: /set up your run/i })).toBeVisible({ timeout: 15_000 });
            await page.waitForTimeout(600);
        });
    });

    for (const fixture of [
        'floorClearWithRouteChoices',
        'floorClearWithShop',
        'sideRoomPrimary',
        'sideRoomChoice',
        'relicDraft',
        'gameOver'
    ] as const) {
        test(`${fixture} fits every window`, async ({ page }) => {
            // These six reach their screen by playing a run, once per viewport. On a slow machine
            // that is six runs in one test, and a 420s cap was timing out mid-sweep — which reads
            // as a failure with no report of what did not fit.
            test.setTimeout(720_000);
            await atEverySize(page, fixture, async () => {
                // The dev-only fixture hook can miss a beat right after a navigation.
                try {
                    await openPlayablePathFixture(page, fixture);
                } catch {
                    await page.waitForTimeout(1500);
                    await openPlayablePathFixture(page, fixture);
                }
                await page.waitForTimeout(700);
            });
        });
    }
});
