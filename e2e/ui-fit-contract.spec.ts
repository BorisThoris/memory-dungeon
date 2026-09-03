import { expect, test, type Page } from '@playwright/test';
import { openPlayablePathFixture, openRunMenuItem } from './playablePathHelpers';
import {
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

        return { scrollers, undersized, clipped, belowFold };
    });

const expectFits = async (page: Page, label: string, viewport: string): Promise<void> => {
    const report = await describeFit(page);
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
            const save = buildVisualSaveJson(true);
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

    for (const fixture of [
        'floorClearWithRouteChoices',
        'floorClearWithShop',
        'sideRoomPrimary',
        'sideRoomChoice',
        'relicDraft',
        'gameOver'
    ] as const) {
        test(`${fixture} fits every window`, async ({ page }) => {
            test.setTimeout(420_000);
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
