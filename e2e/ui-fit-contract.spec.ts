import { expect, test, type Page } from '@playwright/test';
import { openModeDetail, openPlayablePathFixture, openRunMenuItem } from './playablePathHelpers';
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
    unreachable: string[];
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

        // Text the layout is hiding: clamped to fewer lines than it has, or cut horizontally.
        const clipped = leaves
            .filter((el) => {
                const cs = getComputedStyle(el);
                const clampedLines = Number.parseInt(cs.webkitLineClamp, 10);
                const clampCuts = Number.isFinite(clampedLines) && el.scrollHeight > el.clientHeight + 2;
                const ellipsisCuts = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 2;
                const hiddenCuts = cs.overflow === 'hidden' && el.scrollHeight > el.clientHeight + 4;
                return clampCuts || ellipsisCuts || hiddenCuts;
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

        /*
         * A control a click cannot reach. The browse grid paged a card into a frame too short to
         * hold it, so the card was cut in half and its middle sat under the pager: on a Steam Deck
         * panel every mode in the bottom row looked like a button and answered to nothing. Being
         * on screen is not the same as being clickable, and nothing above can tell the difference.
         */
        const CONTROLS = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
        /*
         * A modal covers what is behind it on purpose, so while one is open only the controls
         * inside it are meant to answer. Without this the check reported every button on the board
         * the moment the pause sheet opened, which is the modal working.
         */
        const modals = Array.from(document.querySelectorAll('[aria-modal="true"]')).filter(shown);
        const openModal = modals[modals.length - 1] ?? null;
        const unreachable = Array.from(document.querySelectorAll(CONTROLS))
            // `inert` means the app has already said this subtree is out of reach on purpose.
            .filter((el) => shown(el) && !(el as HTMLElement).hasAttribute('disabled') && !el.closest('[inert]'))
            .filter((el) => openModal === null || openModal.contains(el))
            .filter((el) => {
                const r = el.getBoundingClientRect();
                const x = Math.round(r.left + r.width / 2);
                const y = Math.round(r.top + r.height / 2);
                if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
                    return true;
                }
                const top = document.elementFromPoint(x, y);
                return !top || !(el === top || el.contains(top) || top.contains(el));
            })
            .map(name);

        return { scrollers, undersized, clipped, belowFold, unreachable };
    });

const expectFits = async (page: Page, label: string, viewport: string): Promise<void> => {
    let report = await describeFit(page);
    /*
     * Hit-testing is the one check here that can catch a relayout in progress: after a resize the
     * grids re-measure through a ResizeObserver and a React render, and a card read in that gap
     * sits briefly under the pager. A real overlap is still there a moment later; a transient is
     * not, so only what survives both reads counts.
     */
    if (report.unreachable.length > 0) {
        await page.waitForTimeout(600);
        const second = await describeFit(page);
        report = { ...second, unreachable: second.unreachable.filter((row) => report.unreachable.includes(row)) };
    }
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

    test('the mode detail sheet fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(page, 'mode detail', async () => {
            await gotoWithSave(page, save);
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            await openModeDetail(page, 'Classic Run');
            await page.waitForTimeout(500);
        });
    });

    test('the dungeon showcase fits every window', async ({ page }) => {
        test.setTimeout(420_000);
        const save = buildVisualSaveJson(true);
        await atEverySize(page, 'dungeon showcase', async () => {
            await gotoWithSave(page, save);
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            await page.getByRole('button', { name: /^dungeon showcase$/i }).click();
            await page.waitForTimeout(1200);
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
