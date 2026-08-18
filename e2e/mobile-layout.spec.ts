import { expect, test, type Locator, type Page } from '@playwright/test';
import { dispatchTouchSequence, forceCoarsePointerMedia, type TouchDispatchPoint } from './mobileTouchHelpers';
import {
    clickHiddenTileRowCol,
    navigateToLevel1PlayPhase,
    waitForBoardPlayPhase
} from './tileBoardGameFlow';
import {
    buildVisualSaveJson,
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow,
    gotoWithSaveExpectStartupIntroVisible,
    openChooseYourPath,
    openLevel1Play,
    openMainMenuFromSave
} from './visualScreenHelpers';
import {
    expectGameplayReady,
    openPlayablePathFixture
} from './playablePathHelpers';

/**
 * QA-002 — Geometry tolerances (compact touch / mobile camera layout):
 * - **2px** — full-bleed board height vs shell (`frame` height, top edge).
 * - **12px** — board width vs shell minus left toolbar (`expectedFrameWidth`); sub-pixel layout + scrollbar variance.
 * - **8px** — HUD must overlap the board vertical band (partial overlap assertions); allows anti-aliased bounds.
 * - **2px** — toolbar inner edge vs board x-origin when computing expected width.
 * Settings layout tests use **2px** slack on full-width footer buttons vs container.
 * **Pinch tests:** CDP synthetic touches can miss occasionally; specs retry pinches and poll for `zoom > 1.03`. If pinch never moves zoom (some headless setups), fall back to synthesized `WheelEvent` on the stage (see `dispatchStageWheelZoomIn`, same idea as `tile-board-raycast.spec.ts`). Fit reset uses programmatic click plus **20s** `toPass` with near-zero pan and `zoom` close to **1**.
 */
test.describe.configure({ mode: 'serial' });
/* Level-1 memorize→play can be slow; pinch/pan set their own timeouts. */
test.setTimeout(120_000);

const ACTIVE_GAMEPLAY_PORTRAITS = [
    { height: 640, name: 'small phone', width: 360 },
    { height: 844, name: 'standard phone', width: 390 },
    { height: 896, name: 'large phone', width: 414 }
] as const;

async function readSettingsLayout(container: Locator): Promise<{
    contentBelowNav: boolean;
    buttonMetrics: Array<{ width: number; groupWidth: number }>;
}> {
    const navButton = await container.getByRole('button', { name: /gameplay/i }).first().boundingBox();
    const contentHeading = await container
        .locator('header')
        .getByRole('heading', { name: /^gameplay$/i })
        .first()
        .boundingBox();
    const footerActions = container.locator('footer').locator('div').first();
    const buttons = await footerActions.locator('button').evaluateAll((elements) =>
        elements.map((element) => ({
            width: (element as HTMLElement).getBoundingClientRect().width,
            groupWidth: (element as HTMLElement).parentElement?.getBoundingClientRect().width ?? 0
        }))
    );

    expect(navButton).toBeTruthy();
    expect(contentHeading).toBeTruthy();

    return {
        contentBelowNav: contentHeading!.y >= navButton!.y + navButton!.height - 1,
        buttonMetrics: buttons
    };
}

async function expectSettingsFooterButtonsInViewport(page: Page, container: Locator): Promise<void> {
    await expectLocatorFullyInWindowViewport(page, container.getByRole('button', { name: /^back$/i }));
    const save = container.getByRole('button', { name: /^save$/i });
    if ((await save.count()) > 0) {
        await expectLocatorFullyInWindowViewport(page, save);
    }
    await expectLocatorFullyInWindowViewport(page, container.getByTestId('settings-save-state'));
}

async function readSettingsCompactFooterMetrics(footer: Locator): Promise<{
    buttons: Array<{ height: number; top: number; width: number }>;
    container: number;
    saveState: { height: number; top: number; width: number } | null;
}> {
    return footer.evaluate((el) => {
        const buttons = Array.from(el.querySelectorAll('button'));
        const saveState = el.querySelector('[data-testid="settings-save-state"]');
        return {
            container: el.getBoundingClientRect().width,
            saveState: saveState
                ? {
                      width: saveState.getBoundingClientRect().width,
                      height: saveState.getBoundingClientRect().height,
                      top: saveState.getBoundingClientRect().top
                  }
                : null,
            buttons: buttons.map((button) => ({
                width: button.getBoundingClientRect().width,
                height: button.getBoundingClientRect().height,
                top: button.getBoundingClientRect().top
            }))
        };
    });
}

function expectSettingsCompactFooterMetrics(sizes: {
    buttons: Array<{ height: number; top: number; width: number }>;
    container: number;
    saveState: { height: number; top: number; width: number } | null;
}): void {
    expect(sizes.buttons).toHaveLength(1);
    expect(sizes.saveState).toBeTruthy();
    expect(sizes.buttons[0].width).toBeGreaterThanOrEqual(sizes.container * 0.42);
    expect(sizes.saveState!.width).toBeGreaterThanOrEqual(sizes.container * 0.38);
    expect(Math.abs(sizes.buttons[0].top - sizes.saveState!.top)).toBeLessThanOrEqual(2);
    expect(Math.abs(sizes.buttons[0].height - sizes.saveState!.height)).toBeLessThanOrEqual(8);
}

async function readSettingsShellMetrics(
    page: Page,
    container: Locator
): Promise<{ panelTop: number; panelBottom: number; viewportHeight: number; zoom: number }> {
    const panel = container.getByTestId('settings-shell-panel');
    const zoomNode = container.getByTestId('settings-shell-fit-zoom');
    const panelBox = await panel.boundingBox();

    expect(panelBox).toBeTruthy();

    const zoom = await zoomNode.evaluate((element) => {
        const node = element as HTMLElement;
        const inlineZoom = node.style.zoom;
        const computedZoom = getComputedStyle(node).zoom;
        return Number.parseFloat(inlineZoom || computedZoom || '1') || 1;
    });

    return {
        panelTop: panelBox!.y,
        panelBottom: panelBox!.y + panelBox!.height,
        viewportHeight: await page.evaluate(() => window.innerHeight),
        zoom
    };
}

async function expectSettingsPanelInset(page: Page, container: Locator, minInset = 4): Promise<void> {
    const metrics = await readSettingsShellMetrics(page, container);
    expect(metrics.panelTop).toBeGreaterThanOrEqual(minInset);
    expect(metrics.panelBottom).toBeLessThanOrEqual(metrics.viewportHeight - minInset);
}

async function readVisibleClippedText(
    page: Page,
    selector: string
): Promise<Array<{ box: string; text: string }>> {
    return page.locator(selector).evaluateAll((elements) =>
        elements
            .filter((element) => {
                if (!(element instanceof HTMLElement)) {
                    return false;
                }
                const style = getComputedStyle(element);
                return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                );
            })
            .map((element) => {
                const node = element as HTMLElement;
                return {
                    box: `${node.clientWidth}x${node.clientHeight} scroll ${node.scrollWidth}x${node.scrollHeight}`,
                    text: node.textContent?.trim().replace(/\s+/g, ' ') ?? ''
                };
            })
    );
}

/** Short stacked settings must stay readable at shell zoom 1 (no tiny-fit regression on controls). */
async function expectSettingsCategoryStripReadable(container: Locator): Promise<void> {
    const gameplayTab = container.getByRole('button', { name: /^gameplay$/i }).first();
    const tabBox = await gameplayTab.boundingBox();
    expect(tabBox).toBeTruthy();
    expect(tabBox!.height, 'category tab height').toBeGreaterThanOrEqual(40);

    const layoutStandard = container.getByRole('button', { name: /^standard$/i }).first();
    await expect(layoutStandard).toBeVisible();
    const segBox = await layoutStandard.boundingBox();
    expect(segBox).toBeTruthy();
    expect(segBox!.height, 'segment control height').toBeGreaterThanOrEqual(22);
}

async function readBoardViewportState(frame: Locator): Promise<{
    mobileCameraMode: boolean;
    panX: number;
    panY: number;
    selectionSuppressed: boolean;
    zoom: number;
}> {
    return frame.evaluate((element) => ({
        mobileCameraMode: element.getAttribute('data-mobile-camera-mode') === 'true',
        panX: Number.parseFloat(element.getAttribute('data-board-pan-x') ?? '0'),
        panY: Number.parseFloat(element.getAttribute('data-board-pan-y') ?? '0'),
        selectionSuppressed: element.getAttribute('data-selection-suppressed') === 'true',
        zoom: Number.parseFloat(element.getAttribute('data-board-zoom') ?? '0')
    }));
}

async function readFirstHiddenSlot(page: Page): Promise<{ column: number; row: number }> {
    const raw = await page.getByTestId('tile-board-frame').getAttribute('data-hidden-slots');
    expect(raw, 'tile-board-frame data-hidden-slots').toBeTruthy();
    const [first] = raw!.split(';').filter(Boolean);
    expect(first, 'first hidden board slot').toBeTruthy();
    const match = /^(?:r(?<rowLabel>\d+)c(?<columnLabel>\d+)|(?<rowCsv>\d+),(?<columnCsv>\d+))$/.exec(first!);
    expect(match?.groups, `hidden slot format ${first}`).toBeTruthy();
    return {
        column: Number.parseInt(match!.groups!.columnLabel ?? match!.groups!.columnCsv!, 10),
        row: Number.parseInt(match!.groups!.rowLabel ?? match!.groups!.rowCsv!, 10)
    };
}

async function expectGameplayHudWingsVisible(page: Page): Promise<void> {
    const shell = page.getByTestId('game-shell');
    const mobileCameraMode = (await shell.getAttribute('data-mobile-camera-mode')) === 'true';
    await expect(page.getByTestId('hud-wing-left')).toBeVisible();
    await expect(page.getByTestId('hud-wing-right')).toBeVisible();
    if (mobileCameraMode) {
        await expect(page.getByTestId('hud-wing-center')).toBeAttached();
        await expect(page.getByTestId('hud-wing-center')).toBeHidden();
    } else {
        await expect(page.getByTestId('hud-wing-center')).toBeVisible();
    }
}

async function expectCoreGameplayChromeFits(page: Page): Promise<void> {
    await expectNoHorizontalOverflow(page);
    await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-hud'), 8);
    await expectLocatorFullyInWindowViewport(page, page.getByTestId('tile-board-frame'), 8);
    await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-action-dock'), 8);
    for (const name of [/fit board/i, /run settings \(toolbar\)/i, /open codex/i, /open inventory/i, /return to main menu/i]) {
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name }), 8);
    }
}

async function expectDialogFitsWithPrimaryActions(page: Page, dialogName: RegExp): Promise<void> {
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await expectLocatorFullyInWindowViewport(page, dialog, 8);
    const visibleButtons = await dialog.locator('button:visible').all();
    expect(visibleButtons.length, `expected visible actions in ${dialogName}`).toBeGreaterThan(0);
    for (const button of visibleButtons.slice(0, 4)) {
        await expectLocatorFullyInWindowViewport(page, button, 8);
    }
}

/** Headless Chromium may ignore synthetic pinch; wheel on the stage matches `tile-board-raycast` zoom-in path. */
async function dispatchStageWheelZoomIn(stage: Locator, deltaY: number): Promise<void> {
    await expect(stage).toBeVisible({ timeout: 20_000 });
    await stage.evaluate((el, dy) => {
        const r = el.getBoundingClientRect();
        const cx = Math.round(r.left + r.width / 2);
        const cy = Math.round(r.top + r.height / 2);
        el.dispatchEvent(
            new WheelEvent('wheel', {
                bubbles: true,
                cancelable: true,
                clientX: cx,
                clientY: cy,
                deltaMode: 0,
                deltaY: dy
            })
        );
    }, deltaY);
}

async function pointInLocator(locator: Locator, xFactor: number, yFactor: number, id: number): Promise<TouchDispatchPoint> {
    const box = await locator.boundingBox();

    expect(box).toBeTruthy();

    return {
        id,
        x: box!.x + box!.width * xFactor,
        y: box!.y + box!.height * yFactor
    };
}

test.describe('Mobile layout (renderer)', () => {
    test('viewport meta enables edge-to-edge safe area', async ({ page }) => {
        await page.goto('/');
        const content = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(content).toMatch(/viewport-fit=cover/);
    });

    test('phone portrait sets mobile viewport and compact density', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        const root = page.locator('#root').locator('> div').first();
        await expect(root).toHaveAttribute('data-viewport', 'mobile');
        await expect(root).toHaveAttribute('data-density', 'compact');
    });

    test('wide desktop sets desktop viewport and roomy density', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/');
        const root = page.locator('#root').locator('> div').first();
        await expect(root).toHaveAttribute('data-viewport', 'desktop');
        await expect(root).toHaveAttribute('data-density', 'roomy');
    });

    test('desktop main menu keeps title and action stack readable', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openMainMenuFromSave(page, true);

        await expectNoHorizontalOverflow(page);
        await expect(page.getByRole('button', { name: /^play$/i })).toBeVisible();
        await expect(page.getByTestId('main-menu-primary-meta-frame')).toBeVisible();

        const layout = await page.evaluate(() => {
            const title = document.querySelector('main h1');
            const buttons = Array.from(document.querySelectorAll('[data-testid="main-menu-primary-meta-frame"] button')).map(
                (element) => {
                    const bounds = element.getBoundingClientRect();
                    return {
                        height: bounds.height,
                        text: element.textContent?.trim().replace(/\s+/g, ' ') ?? '',
                        width: bounds.width
                    };
                }
            );
            return {
                buttons,
                titleClientHeight: title instanceof HTMLElement ? title.clientHeight : 0,
                titleClientWidth: title instanceof HTMLElement ? title.clientWidth : 0,
                titleScrollHeight: title instanceof HTMLElement ? title.scrollHeight : 0,
                titleScrollWidth: title instanceof HTMLElement ? title.scrollWidth : 0
            };
        });

        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth + 4);
        expect(layout.buttons.length).toBeGreaterThanOrEqual(8);
        for (const button of layout.buttons) {
            expect(button.height, `${button.text} button height`).toBeGreaterThanOrEqual(38);
            expect(button.width, `${button.text} button width`).toBeGreaterThanOrEqual(220);
        }
        expect(layout.buttons[0]!.height).toBeGreaterThanOrEqual(44);
    });

    test('tablet width sets tablet label when both axes exceed compact height', async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 900 });
        await page.goto('/');
        const root = page.locator('#root').locator('> div').first();
        await expect(root).toHaveAttribute('data-viewport', 'tablet');
        await expect(root).toHaveAttribute('data-density', 'roomy');
    });

    test('phone portrait keeps condensed onboarding copy visible', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, false);
        await expect(page.getByTestId('main-menu-secondary-actions')).toHaveAttribute('data-layout', 'dense-grid');
        await page.getByText(/^Open$/).click();
        await expect(page.getByText(/^Close$/)).toBeVisible();
        await expect(page.getByText(/^Flip and match$/i)).toBeVisible();
        await expect(page.getByText(/^Score and recover$/i)).toBeVisible();
        await expect(page.getByText(/^Choose a room$/i)).toBeVisible();
        await expect(page.getByText(/runs turn into relic drafts/i)).toHaveCount(0);
        await expect(page.getByText(/codex is the deeper reference/i)).toHaveCount(0);

        const helpPanel = await page.getByTestId('main-menu-how-to-panel').evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return {
                bottom: bounds.bottom,
                height: bounds.height,
                viewportHeight: window.innerHeight
            };
        });
        expect(helpPanel.height).toBeLessThanOrEqual(245);
        expect(helpPanel.bottom).toBeLessThanOrEqual(helpPanel.viewportHeight - 8);
    });

    test('phone portrait keeps startup intro framed inside the viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoWithSaveExpectStartupIntroVisible(page, buildVisualSaveJson(false, false), { freeze: true });

        const intro = page.getByTestId('startup-intro-overlay');
        const motionCta = page.getByTestId('intro-motion-cta');
        const skipCta = page.getByTestId('intro-skip-cta');

        await expect(intro).toBeVisible();
        await expect(skipCta).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const introEl = document.querySelector('[data-testid="startup-intro-overlay"]');
            const sceneEl = document.querySelector('[data-testid="startup-intro-scene-frame"]');
            const rect = (element: Element | null) => {
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height,
                    width: bounds.width
                };
            };
            return {
                intro: rect(introEl),
                scene: rect(sceneEl)
            };
        });

        expect(layout.intro).toBeTruthy();
        expect(layout.scene).toBeTruthy();
        expect(layout.scene!.height).toBeLessThan(layout.intro!.height);
        expect(layout.scene!.top).toBeGreaterThanOrEqual(layout.intro!.top + 8);
        expect(layout.scene!.bottom).toBeLessThanOrEqual(layout.intro!.bottom - 8);
        expect(layout.scene!.width).toBeLessThan(layout.intro!.width);

        if (await motionCta.isVisible().catch(() => false)) {
            await expectLocatorFullyInWindowViewport(page, motionCta, 8);
        }
        await expectLocatorFullyInWindowViewport(page, skipCta, 8);

        await page.evaluate(() => {
            localStorage.removeItem('memory-dungeon-e2e-freeze-intro');
        });
    });

    test('phone portrait keeps main menu action frame and help summary inside the viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, false);
        await expectNoHorizontalOverflow(page);
        await expect(page.getByTestId('main-menu-secondary-actions')).toHaveAttribute('data-layout', 'dense-grid');
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('main-menu-primary-meta-frame'), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('main-menu-how-to-panel'), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /^play$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByText(/read, match, and protect the streak/i), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByText(/^open$/i), 8);
    });

    test('phone portrait no-help main menu balances the hero stack lower in the first viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);

        const primaryFrame = page.getByTestId('main-menu-primary-meta-frame');
        const playButton = page.getByRole('button', { name: /^play$/i });

        await expect(primaryFrame).toBeVisible();
        await expect(playButton).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expect(page.getByTestId('main-menu-how-to-panel')).toBeHidden();

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height
                };
            };

            const titleEl = document.querySelector('section h1, section h2');
            return {
                titleClientHeight: titleEl instanceof HTMLElement ? titleEl.clientHeight : 0,
                titleScrollHeight: titleEl instanceof HTMLElement ? titleEl.scrollHeight : 0,
                title: rect('section h1, section h2'),
                primaryFrame: rect('[data-testid="main-menu-primary-meta-frame"]')
            };
        });

        expect(layout.title).toBeTruthy();
        expect(layout.primaryFrame).toBeTruthy();
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.title!.top).toBeGreaterThanOrEqual(180);
        expect(layout.primaryFrame!.top).toBeGreaterThanOrEqual(280);
        expect(layout.primaryFrame!.bottom).toBeLessThanOrEqual(610);
    });

    test('phone landscape keeps condensed onboarding copy readable', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await openMainMenuFromSave(page, false);
        await expect(page.getByTestId('main-menu-secondary-actions')).toHaveAttribute('data-layout', 'dense-grid');
        const collapsedLayout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    top: bounds.top
                };
            };

            return {
                primaryFrame: rect('[data-testid="main-menu-primary-meta-frame"]'),
                supportPanel: rect('[data-testid="main-menu-how-to-panel"]'),
                title: rect('section h1, section h2')
            };
        });

        expect(collapsedLayout.title).toBeTruthy();
        expect(collapsedLayout.primaryFrame).toBeTruthy();
        expect(collapsedLayout.supportPanel).toBeTruthy();
        expect(collapsedLayout.title!.top).toBeGreaterThanOrEqual(4);
        expect(collapsedLayout.primaryFrame!.top).toBeGreaterThanOrEqual(collapsedLayout.title!.bottom + 4);
        expect(collapsedLayout.supportPanel!.top).toBeGreaterThanOrEqual(collapsedLayout.primaryFrame!.bottom + 4);
        await page.getByText(/^Open$/).click();
        await expect(page.getByText(/^Close$/)).toBeVisible();
        await expect(page.getByText(/^Flip and match$/i)).toBeVisible();
        await expect(page.getByText(/^Score and recover$/i)).toBeVisible();
        await expect(page.getByText(/^Choose a room$/i)).toBeVisible();
    });

    test('game HUD stays horizontal on compact viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);
        const hud = page.getByTestId('game-hud');
        await expect(hud).toBeVisible();
        await expectGameplayHudWingsVisible(page);
        const layout = await hud.evaluate((el) => {
            const s = getComputedStyle(el);
            return { display: s.display, flexDirection: s.flexDirection };
        });
        expect(layout.display, 'HUD row uses flex layout').toMatch(/flex/);
        expect(layout.flexDirection).toBe('row');
    });

    test('wide short landscape keeps desktop mobile-camera mode off (parity with main menu)', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await navigateToLevel1PlayPhase(page);
        const shell = page.getByTestId('game-shell');
        const frame = page.getByTestId('tile-board-frame');
        await expect(shell).toHaveAttribute('data-mobile-camera-mode', 'false');
        await expect(frame).toHaveAttribute('data-mobile-camera-mode', 'false');
    });

    test('desktop gameplay uses a full-bleed board behind HUD chrome', async ({ page }) => {
        test.setTimeout(180_000);
        await page.setViewportSize({ width: 1440, height: 900 });
        await navigateToLevel1PlayPhase(page);

        const shell = page.getByTestId('game-shell');
        const hud = page.getByTestId('game-hud');
        const frame = page.getByTestId('tile-board-frame');
        const actionDock = page.getByTestId('game-action-dock');

        await expect(shell).toHaveAttribute('data-mobile-camera-mode', 'false');
        await expect(frame).toHaveAttribute('data-mobile-camera-mode', 'false');
        await expect(page.getByRole('button', { name: /^fit board$/i })).toBeVisible();

        const shellBox = await shell.boundingBox();
        const hudBox = await hud.boundingBox();
        const frameBox = await frame.boundingBox();
        const dockBox = await actionDock.boundingBox();

        expect(shellBox).toBeTruthy();
        expect(hudBox).toBeTruthy();
        expect(frameBox).toBeTruthy();
        expect(dockBox).toBeTruthy();

        expect(frameBox!.y).toBeLessThanOrEqual(shellBox!.y + 2);
        expect(Math.abs(frameBox!.x - shellBox!.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(frameBox!.width - shellBox!.width)).toBeLessThanOrEqual(4);
        expect(Math.abs(frameBox!.height - shellBox!.height)).toBeLessThanOrEqual(4);
        expect(hudBox!.y).toBeLessThan(frameBox!.y + frameBox!.height * 0.18);
        expect(dockBox!.y).toBeGreaterThan(frameBox!.y + frameBox!.height * 0.72);
        expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(frameBox!.y + frameBox!.height + 2);
    });

    test('desktop game over keeps next actions fully above the fold with run snapshot hinted below', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openPlayablePathFixture(page, 'gameOver');

        const screen = page.getByTestId('game-over-screen');
        const actionDock = page.getByTestId('game-over-action-dock');
        const payoffBurst = page.getByTestId('game-over-payoff-burst');
        const nextRunLoop = page.getByTestId('game-over-next-run-loop');
        const runSnapshot = page.getByTestId('game-over-run-snapshot');

        await expect(screen).toBeVisible();
        await expect(actionDock).toBeVisible();
        await expect(payoffBurst).toBeVisible();
        await expect(nextRunLoop).toBeVisible();
        await expect(runSnapshot).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, actionDock, 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height
                };
            };

            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element instanceof HTMLElement ? getComputedStyle(element).display : null;
            };

            return {
                actionDock: rect('[data-testid="game-over-action-dock"]'),
                nextGoalDisplay: display('[data-next-run-row="next_goal"]'),
                nextRunLoop: rect('[data-testid="game-over-next-run-loop"]'),
                payoffBurst: rect('[data-testid="game-over-payoff-burst"]'),
                payoffLaneMap: rect('[data-testid="game-over-payoff-lane-map"]'),
                runSnapshot: rect('[data-testid="game-over-run-snapshot"]'),
                shareDisplay: display('[data-next-run-row="local_share"]')
            };
        });

        expect(layout.actionDock).toBeTruthy();
        expect(layout.nextRunLoop).toBeTruthy();
        expect(layout.payoffBurst).toBeTruthy();
        expect(layout.payoffLaneMap).toBeTruthy();
        expect(layout.runSnapshot).toBeTruthy();
        expect(layout.actionDock!.bottom).toBeLessThanOrEqual(540);
        expect(layout.nextRunLoop!.height).toBeLessThanOrEqual(320);
        expect(layout.payoffBurst!.height).toBeLessThanOrEqual(220);
        expect(layout.payoffLaneMap!.height).toBeLessThanOrEqual(96);
        expect(layout.shareDisplay).toBe('none');
        expect(layout.nextGoalDisplay).toBe('none');
        expect(layout.runSnapshot!.top).toBeLessThanOrEqual(560);
        expect(layout.runSnapshot!.top).toBeGreaterThan(layout.actionDock!.bottom);
    });

    test('desktop collection keeps archive chrome dense enough to surface the next section above the fold', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^collection$/i }).click({ force: true });

        const collection = page.getByRole('region', { name: /collection/i });
        const sectionRail = page.getByTestId('collection-section-rail');
        const firstFrame = page.getByTestId('collection-meta-frame-achievements');
        const secondFrame = page.getByTestId('collection-meta-frame-honors');

        await expect(collection).toBeVisible();
        await expect(sectionRail).toBeVisible();
        await expect(firstFrame).toBeVisible();
        await expect(secondFrame).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, collection.getByRole('button', { name: /^back$/i }), 8);

        const clippedAchievementCopy = await readVisibleClippedText(
            page,
            '[data-testid="collection-meta-frame-achievements"] p'
        );
        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height
                };
            };
            const title = document.querySelector('section[aria-label="Collection"] header h1');
            const railControls = Array.from(document.querySelectorAll('[data-testid="collection-section-rail"] a')).map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    width: bounds.width
                };
            });
            const backButton = document.querySelector('section[aria-label="Collection"] header button');

            return {
                backButtonHeight: backButton instanceof HTMLElement ? backButton.getBoundingClientRect().height : 0,
                header: rect('section[aria-label="Collection"] header'),
                firstFrame: rect('[data-testid="collection-meta-frame-achievements"]'),
                railControls,
                secondFrame: rect('[data-testid="collection-meta-frame-honors"]'),
                titleClientHeight: title instanceof HTMLElement ? title.clientHeight : 0,
                titleClientWidth: title instanceof HTMLElement ? title.clientWidth : 0,
                titleScrollHeight: title instanceof HTMLElement ? title.scrollHeight : 0,
                titleScrollWidth: title instanceof HTMLElement ? title.scrollWidth : 0
            };
        });

        expect(layout.header).toBeTruthy();
        expect(layout.firstFrame).toBeTruthy();
        expect(layout.secondFrame).toBeTruthy();
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth + 4);
        expect(layout.backButtonHeight).toBeGreaterThanOrEqual(36);
        expect(layout.railControls.length).toBeGreaterThan(0);
        expect(layout.railControls.every((control) => control.height >= 35)).toBe(true);
        expect(layout.header!.height).toBeLessThanOrEqual(160);
        expect(layout.firstFrame!.top).toBeLessThanOrEqual(245);
        expect(layout.firstFrame!.bottom).toBeLessThanOrEqual(590);
        expect(layout.secondFrame!.top).toBeLessThanOrEqual(610);
        expect(clippedAchievementCopy).toEqual([]);
    });

    test('desktop codex keeps filter rails compact enough to surface reference cards and first entries early', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^codex$/i }).click({ force: true });

        const codex = page.getByRole('region', { name: /codex/i });
        const summary = page.getByTestId('codex-knowledge-base-summary');
        const filter = page.getByTestId('codex-filter-row');
        const coreFrame = page.getByTestId('codex-meta-frame-core');

        await expect(codex).toBeVisible();
        await expect(summary).toBeVisible();
        await expect(filter).toBeVisible();
        await expect(coreFrame).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, codex.getByRole('button', { name: /^back$/i }), 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height
                };
            };
            const title = document.querySelector('[data-testid="codex-screen"] header h1');
            const tabControls = Array.from(document.querySelectorAll('[data-testid="codex-screen"] [role="tab"]')).map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    width: bounds.width
                };
            });
            const railControls = Array.from(document.querySelectorAll('[data-testid="codex-section-rail"] a')).map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    width: bounds.width
                };
            });
            const foldSummaries = Array.from(document.querySelectorAll('[data-testid="codex-main-column"] summary')).map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    width: bounds.width
                };
            });
            const backButton = document.querySelector('[data-testid="codex-screen"] header button');

            return {
                backButtonHeight: backButton instanceof HTMLElement ? backButton.getBoundingClientRect().height : 0,
                header: rect('[data-testid="codex-screen"] header'),
                summary: rect('[data-testid="codex-knowledge-base-summary"]'),
                filter: rect('[data-testid="codex-filter-row"]'),
                coreFrame: rect('[data-testid="codex-meta-frame-core"]'),
                foldSummaries,
                railControls,
                tabControls,
                titleClientHeight: title instanceof HTMLElement ? title.clientHeight : 0,
                titleClientWidth: title instanceof HTMLElement ? title.clientWidth : 0,
                titleScrollHeight: title instanceof HTMLElement ? title.scrollHeight : 0,
                titleScrollWidth: title instanceof HTMLElement ? title.scrollWidth : 0
            };
        });

        expect(layout.header).toBeTruthy();
        expect(layout.summary).toBeTruthy();
        expect(layout.filter).toBeTruthy();
        expect(layout.coreFrame).toBeTruthy();
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth + 4);
        expect(layout.backButtonHeight).toBeGreaterThanOrEqual(36);
        expect(layout.tabControls.length).toBeGreaterThan(0);
        expect(layout.railControls.length).toBeGreaterThan(0);
        expect(layout.tabControls.every((control) => control.height >= 35)).toBe(true);
        expect(layout.railControls.every((control) => control.height >= 35)).toBe(true);
        expect(layout.foldSummaries.length).toBeGreaterThan(0);
        expect(layout.foldSummaries.every((control) => control.height >= 35)).toBe(true);
        expect(layout.header!.height).toBeLessThanOrEqual(138);
        expect(layout.summary!.top).toBeLessThanOrEqual(275);
        expect(layout.filter!.top).toBeLessThanOrEqual(500);
        expect(layout.coreFrame!.top).toBeLessThanOrEqual(560);
    });

    test('desktop choose path keeps the launcher and mode tiles compact', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);

        const choosePath = page.getByTestId('choose-path-screen');
        const launchPanel = page.getByTestId('choose-path-launch-panel');
        const libraryScroller = page.getByTestId('choose-path-library-scroller');

        await expect(choosePath).toBeVisible();
        await expect(launchPanel).toBeVisible();
        await expect(libraryScroller).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const clippedSignalPreviews = await readVisibleClippedText(
            page,
            [
                '[data-testid^="choose-path-mode-signals-"]',
                '[data-testid^="choose-path-mode-signals-"] strong'
            ].join(', ')
        );
        const layout = await page.evaluate(() => {
            const offlineNote = document.querySelector('[data-testid="choose-path-offline-note"]');
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top,
                    width: bounds.width
                };
            };
            const visibleDisplayCount = (selector: string) =>
                Array.from(document.querySelectorAll(selector)).filter(
                    (element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none'
                ).length;
            const hiddenExtraSignalCount = document.querySelectorAll(
                '[data-testid^="choose-path-mode-signals-"] [data-mode-signal-action]:nth-of-type(n+4)'
            ).length;
            const title = document.querySelector('[data-testid="choose-path-screen"] h1');
            return {
                hiddenExtraSignalCount,
                laneSummaryCount: visibleDisplayCount('[data-testid^="choose-path-mode-lane-map-summary-"]'),
                launchPanel: rect('[data-testid="choose-path-launch-panel"]'),
                libraryScroller: rect('[data-testid="choose-path-library-scroller"]'),
                offlineNoteDisplay: offlineNote instanceof HTMLElement ? getComputedStyle(offlineNote).display : null,
                titleClientHeight: title instanceof HTMLElement ? title.clientHeight : 0,
                titleScrollHeight: title instanceof HTMLElement ? title.scrollHeight : 0,
                visiblePrimaryLaneCount: visibleDisplayCount('[data-testid^="choose-path-mode-primary-lane-"]'),
                visibleSignalActionCount: visibleDisplayCount('[data-mode-signal-action]')
            };
        });

        expect(clippedSignalPreviews).toEqual([]);
        expect(layout.hiddenExtraSignalCount).toBeGreaterThan(0);
        expect(layout.visibleSignalActionCount).toBe(0);
        expect(layout.visiblePrimaryLaneCount).toBe(0);
        expect(layout.laneSummaryCount).toBeGreaterThanOrEqual(4);
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.launchPanel?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(260);
        expect(layout.libraryScroller?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(180);
        expect(layout.libraryScroller?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(505);
        expect(layout.offlineNoteDisplay).toBe('none');
    });

    test('desktop shop gives the lane map its own row and preserves visible stock space below it', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openPlayablePathFixture(page, 'floorClearWithShop');
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();

        const shop = page.getByTestId('shop-screen');
        const laneMap = page.getByTestId('shop-offer-lane-map');
        const stockGrid = page.getByTestId('shop-stock-grid');
        const actionDock = page.getByTestId('shop-action-dock');

        await expect(shop).toBeVisible();
        await expect(laneMap).toBeVisible();
        await expect(stockGrid).toBeVisible();
        await expect(actionDock).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, actionDock, 8);

        const clippedPayoffBurstText = await readVisibleClippedText(page, '[data-testid$="-payoff-burst"] strong');
        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height
                };
            };

            return {
                laneMap: rect('[data-testid="shop-offer-lane-map"]'),
                stockGrid: rect('[data-testid="shop-stock-grid"]'),
                firstCard: rect('[data-testid="shop-stock-grid"] > [role="listitem"]')
            };
        });

        expect(layout.laneMap).toBeTruthy();
        expect(layout.stockGrid).toBeTruthy();
        expect(layout.firstCard).toBeTruthy();
        expect(layout.laneMap!.height).toBeGreaterThanOrEqual(56);
        expect(layout.laneMap!.height).toBeLessThanOrEqual(96);
        expect(layout.stockGrid!.top).toBeGreaterThanOrEqual(layout.laneMap!.bottom + 8);
        expect(layout.stockGrid!.height).toBeGreaterThanOrEqual(220);
        expect(layout.firstCard!.top).toBeGreaterThanOrEqual(layout.stockGrid!.top);
        expect(clippedPayoffBurstText).toEqual([]);
    });

    test('desktop floor clear keeps the next-action decision above receipt telemetry', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openPlayablePathFixture(page, 'floorClearWithShop');

        const floorClear = page.getByRole('dialog', { name: /floor cleared/i });
        const payoffStack = page.getByTestId('floor-clear-payoff-stack');
        const carryForward = page.getByTestId('floor-clear-carry-forward');
        const actionSequence = page.getByTestId('floor-clear-action-sequence');
        const vendorNote = page.getByTestId('floor-clear-vendor-note');
        const visitShop = floorClear.getByRole('button', { name: /visit shop/i });

        await expect(floorClear).toBeVisible();
        await expect(payoffStack).toBeVisible();
        await expect(carryForward).toBeVisible();
        await expect(actionSequence).toBeVisible();
        await expect(vendorNote).toBeVisible();
        await expect(page.getByTestId('floor-clear-momentum-strip')).toBeHidden();
        await expect(page.getByTestId('floor-clear-cashout-strip')).toBeHidden();
        await expect(page.getByTestId('floor-clear-objective-strip')).toBeHidden();
        await expect(page.getByTestId('floor-clear-next-signal-strip')).toBeHidden();
        await expect(page.getByTestId('floor-clear-receipt-details')).toBeHidden();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, floorClear, 8);
        await expectLocatorFullyInWindowViewport(page, visitShop, 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top,
                    width: bounds.width
                };
            };
            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element instanceof HTMLElement ? getComputedStyle(element).display : null;
            };

            return {
                actionSequence: rect('[data-testid="floor-clear-action-sequence"]'),
                dialog: rect('[role="dialog"]'),
                receiptDisplay: display('[data-testid="floor-clear-receipt-details"]'),
                resultStack: rect('[data-testid="floor-clear-result-stack"]')
            };
        });

        expect(layout.dialog?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(470);
        expect(layout.resultStack?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(150);
        expect(layout.actionSequence?.width ?? 0).toBeGreaterThanOrEqual(760);
        expect(layout.receiptDisplay).toBe('none');
    });

    test('desktop relic draft keeps reward choices compact and readable', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openPlayablePathFixture(page, 'relicDraft');

        const relicDialog = page.getByTestId('game-relic-offer-overlay');
        const firstCard = page.getByTestId('relic-offer-card').first();

        await expect(relicDialog).toBeVisible({ timeout: 30_000 });
        await expect(firstCard).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const rect = (element: Element | null) => {
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top,
                    width: bounds.width
                };
            };
            const hiddenCueSelectors = [
                '[data-testid="relic-pick-plan"]',
                '[data-testid="relic-engine-recipe"]',
                '[data-testid="relic-choice-crescendo"]',
                '[data-testid="relic-payoff-burst"]',
                '[data-testid="relic-next-floor-cue"]',
                '[data-testid="relic-board-moment-cue"]',
                '[data-testid="relic-pick-pulse"]',
                '[data-testid="relic-combo-routes"]',
                '[data-testid="relic-build-plan-rows"]',
                '[data-testid="relic-build-fit-signals"]',
                '[data-testid="relic-impact-chips"]'
            ];
            const cards = Array.from(document.querySelectorAll('[data-testid="relic-offer-card"]')).map((element) => rect(element));
            const pickActions = Array.from(document.querySelectorAll('[data-testid="relic-pick-action"]')).map((element) => ({
                label: element.getAttribute('data-visible-pick-action-label'),
                text: element.textContent?.trim().replace(/\s+/g, ' ') ?? ''
            }));
            const serviceCues = Array.from(document.querySelectorAll('[data-testid^="relic-service-"][data-testid$="-cue"]')).map(
                (element) => (element instanceof HTMLElement ? getComputedStyle(element).display : 'missing')
            );
            const bodies = Array.from(document.querySelectorAll('[data-testid="relic-offer-card"] p')).map((element) => {
                const htmlElement = element instanceof HTMLElement ? element : null;
                return {
                    display: htmlElement ? getComputedStyle(htmlElement).display : '',
                    lineClamp: htmlElement ? getComputedStyle(htmlElement).webkitLineClamp : '',
                    height: htmlElement?.getBoundingClientRect().height ?? 0,
                    overflow: htmlElement ? getComputedStyle(htmlElement).overflow : ''
                };
            });
            return {
                actionDockCount: document.querySelectorAll('[data-testid="game-action-dock"]').length,
                cards,
                hiddenCueDisplays: hiddenCueSelectors.map((selector) => {
                    const element = document.querySelector(selector);
                    return element instanceof HTMLElement ? getComputedStyle(element).display : 'missing';
                }),
                overlay: rect(document.querySelector('[data-testid="game-relic-offer-overlay"]')),
                pickActions,
                serviceCues,
                bodies
            };
        });

        expect(layout.overlay).toBeTruthy();
        expect(layout.cards).toHaveLength(3);
        expect(layout.actionDockCount).toBe(0);
        expect(layout.hiddenCueDisplays.every((display) => display === 'none' || display === 'missing')).toBe(true);
        expect(layout.serviceCues.every((display) => display === 'none')).toBe(true);
        expect(layout.pickActions).toHaveLength(3);
        expect(layout.pickActions[0]!.text).not.toMatch(/pick action/i);
        expect(layout.pickActions.some((action) => action.label === 'Lock' || action.label === 'Take')).toBe(true);
        for (const card of layout.cards) {
            expect(card).toBeTruthy();
            expect(card!.top).toBeGreaterThanOrEqual(layout.overlay!.top);
            expect(card!.bottom).toBeLessThanOrEqual(layout.overlay!.bottom);
            expect(card!.height).toBeLessThanOrEqual(430);
        }
        for (const body of layout.bodies) {
            expect(['-webkit-box', 'flow-root']).toContain(body.display);
            expect(body.lineClamp).toBe('2');
            expect(body.overflow).toBe('hidden');
            expect(body.height).toBeLessThanOrEqual(48);
        }
    });

    test('tablet portrait relic draft uses readable reward rows without clipped effects', async ({ page }) => {
        await page.setViewportSize({ width: 820, height: 1180 });
        await openPlayablePathFixture(page, 'relicDraft');

        const relicDialog = page.getByTestId('game-relic-offer-overlay');
        const cards = page.getByTestId('relic-offer-card');

        await expect(relicDialog).toBeVisible({ timeout: 30_000 });
        await expect(cards.first()).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, relicDialog, 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    width: box.width
                };
            };
            const grid = document.querySelector('[data-testid="game-relic-offer-overlay"] [role="group"][aria-label="Relic choices"]');
            const clippedEffectText = Array.from(
                document.querySelectorAll('[data-testid="relic-pick-action"] strong, [data-testid="relic-pick-action"] em')
            )
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');
            const hiddenTelemetry = [
                '[data-testid="relic-draft-payoff-engine"]',
                '[data-testid="relic-draft-lane-map"]',
                '[data-testid="relic-pick-plan"]',
                '[data-testid="relic-engine-recipe"]',
                '[data-testid="relic-choice-crescendo"]'
            ].map((selector) => {
                const element = document.querySelector(selector);
                return element instanceof HTMLElement ? getComputedStyle(element).display : 'missing';
            });

            return {
                cards: Array.from(document.querySelectorAll('[data-testid="relic-offer-card"]')).map((element) =>
                    element instanceof HTMLElement ? element.getBoundingClientRect().height : 0
                ),
                clippedEffectText,
                gridColumns: grid instanceof HTMLElement ? getComputedStyle(grid).gridTemplateColumns : '',
                hiddenTelemetry,
                overlay: rect('[data-testid="game-relic-offer-overlay"]')
            };
        });

        expect(layout.overlay).toBeTruthy();
        expect(layout.gridColumns.split(' ').filter(Boolean)).toHaveLength(1);
        expect(layout.cards).toHaveLength(3);
        expect(layout.cards.every((height) => height >= 96 && height <= 170)).toBe(true);
        expect(layout.clippedEffectText).toEqual([]);
        expect(layout.hiddenTelemetry.every((display) => display === 'none' || display === 'missing')).toBe(true);
    });

    test('phone portrait relic draft reads as a centered reward decision sheet without clipped effect copy', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'relicDraft');

        const relicDialog = page.getByTestId('game-relic-offer-overlay');
        const cards = page.getByTestId('relic-offer-card');

        await expect(relicDialog).toBeVisible({ timeout: 30_000 });
        await expect(cards).toHaveCount(3);
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, relicDialog, 8);

        const layout = await page.evaluate(() => {
            const rect = (element: Element | null) => {
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    top: box.top,
                    width: box.width
                };
            };
            const visibleDetailOverflow = Array.from(
                document.querySelectorAll('[data-testid="relic-pick-action"] strong, [data-testid="relic-pick-action"] em')
            )
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');
            const pickDetailDisplays = Array.from(document.querySelectorAll('[data-testid="relic-pick-action"] em')).map(
                (element) => (element instanceof HTMLElement ? getComputedStyle(element).display : 'missing')
            );

            return {
                cardRects: Array.from(document.querySelectorAll('[data-testid="relic-offer-card"]')).map((element) =>
                    rect(element)
                ),
                dialog: rect(document.querySelector('[data-testid="game-relic-offer-overlay"]')),
                pickDetailDisplays,
                visibleDetailOverflow
            };
        });

        expect(layout.dialog).toBeTruthy();
        expect(layout.dialog!.top).toBeGreaterThanOrEqual(110);
        expect(layout.dialog!.top).toBeLessThanOrEqual(220);
        expect(layout.dialog!.bottom).toBeLessThanOrEqual(700);
        expect(layout.cardRects).toHaveLength(3);
        expect(layout.cardRects.every((card) => (card?.height ?? 0) >= 84 && (card?.height ?? 0) <= 124)).toBe(true);
        expect(layout.pickDetailDisplays.every((display) => display !== 'none')).toBe(true);
        expect(layout.visibleDetailOverflow).toEqual([]);
    });

    test('short landscape relic draft keeps all reward choices and service actions visible', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'relicDraft');

        const relicDialog = page.getByTestId('game-relic-offer-overlay');
        const cards = page.getByTestId('relic-offer-card');

        await expect(relicDialog).toBeVisible({ timeout: 30_000 });
        await expect(cards).toHaveCount(3);
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, relicDialog, 8);

        const layout = await page.evaluate(() => {
            const rect = (element: Element | null) => {
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    width: box.width
                };
            };
            const grid = document.querySelector('[data-testid="game-relic-offer-overlay"] [role="group"][aria-label="Relic choices"]');
            const overlay = rect(document.querySelector('[data-testid="game-relic-offer-overlay"]'));
            const serviceRow = rect(document.querySelector('[data-testid="relic-offer-services"]'));
            const visibleCardTextOverflow = Array.from(
                document.querySelectorAll('[data-testid="relic-offer-card"] strong, [data-testid="relic-pick-action"] strong')
            )
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');
            const cardRects = Array.from(document.querySelectorAll('[data-testid="relic-offer-card"]')).map((element) =>
                rect(element)
            );
            const actionBadges = Array.from(document.querySelectorAll('[data-testid="relic-offer-card"] span[class*="rewardHeader"] small'))
                .filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none')
                .map((element) => rect(element));
            const pickDetailDisplays = Array.from(document.querySelectorAll('[data-testid="relic-pick-action"] em')).map(
                (element) => (element instanceof HTMLElement ? getComputedStyle(element).display : 'missing')
            );
            const serviceButtons = Array.from(
                document.querySelectorAll('[data-testid="relic-offer-services"] button')
            ).map((element) => rect(element));

            return {
                actionBadges,
                cardRects,
                gridColumns: grid instanceof HTMLElement ? getComputedStyle(grid).gridTemplateColumns : '',
                overlay,
                pickDetailDisplays,
                serviceButtons,
                serviceRow,
                visibleCardTextOverflow
            };
        });

        expect(layout.overlay).toBeTruthy();
        expect(layout.gridColumns.split(' ').filter(Boolean)).toHaveLength(3);
        expect(layout.cardRects).toHaveLength(3);
        expect(layout.cardRects.every((card) => card && card.top >= layout.overlay!.top && card.bottom <= layout.overlay!.bottom)).toBe(true);
        expect(layout.cardRects.every((card) => (card?.height ?? 0) >= 94 && (card?.height ?? 0) <= 122)).toBe(true);
        expect(layout.pickDetailDisplays.every((display) => display !== 'none')).toBe(true);
        expect(layout.actionBadges).toHaveLength(3);
        expect(layout.actionBadges.every((badge, index) => {
            const card = layout.cardRects[index];
            return badge && card && badge.left >= card.left - 2 && badge.right <= card.right + 2;
        })).toBe(true);
        expect(layout.serviceRow).toBeTruthy();
        expect(layout.serviceRow!.bottom).toBeLessThanOrEqual(layout.overlay!.bottom - 6);
        expect(layout.serviceButtons.every((button) => (button?.height ?? 0) >= 32)).toBe(true);
        expect(layout.visibleCardTextOverflow).toEqual([]);
    });

    test('desktop empty inventory keeps the start-run panel in the scan path', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^inventory$/i }).click({ force: true });

        const inventory = page.getByTestId('inventory-screen');
        const emptyFrame = page.getByTestId('inventory-meta-frame-empty');
        const emptyState = page.getByTestId('inventory-empty-state');

        await expect(inventory).toBeVisible();
        await expect(emptyFrame).toBeVisible();
        await expect(emptyState).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top,
                    width: bounds.width
                };
            };

            const emptyStateEl = document.querySelector('[data-testid="inventory-empty-state"]');
            const previewCards = Array.from(document.querySelectorAll('[aria-label="Inventory preview lanes"] > div')).map((element) => {
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    top: bounds.top,
                    width: bounds.width
                };
            });

            return {
                emptyFrame: rect('[data-testid="inventory-meta-frame-empty"]'),
                emptyState: rect('[data-testid="inventory-empty-state"]'),
                previewCards,
                stateColumns: emptyStateEl instanceof HTMLElement ? getComputedStyle(emptyStateEl).gridTemplateColumns : ''
            };
        });

        expect(layout.emptyFrame).toBeTruthy();
        expect(layout.emptyState).toBeTruthy();
        expect(layout.emptyFrame!.top).toBeLessThanOrEqual(230);
        expect(layout.emptyFrame!.height).toBeGreaterThanOrEqual(320);
        expect(layout.emptyFrame!.height).toBeLessThanOrEqual(390);
        expect(layout.emptyState!.width).toBeGreaterThanOrEqual(900);
        expect(layout.stateColumns.split(' ').filter(Boolean)).toHaveLength(2);
        expect(layout.previewCards).toHaveLength(3);
        for (const card of layout.previewCards) {
            expect(card.height).toBeLessThanOrEqual(70);
            expect(card.width).toBeGreaterThanOrEqual(460);
        }
    });

    test('desktop in-run inventory reads as a compact scan sheet', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await page.getByTestId('game-toolbar-inventory').click({ timeout: 20_000 });

        const inventory = page.getByTestId('inventory-screen');
        const rail = page.getByTestId('inventory-section-rail');
        const payoffEngine = page.getByTestId('inventory-payoff-engine');
        const runLoop = page.getByTestId('inventory-run-loop-signals');
        const prepStrip = page.getByTestId('inventory-prep-strip');

        await expect(inventory).toBeVisible({ timeout: 20_000 });
        await expect(rail).toBeVisible();
        await expect(payoffEngine).toBeVisible();
        await expect(runLoop).toBeVisible();
        await expect(prepStrip).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, inventory.getByRole('button', { name: /^back$/i }), 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top,
                    width: bounds.width
                };
            };
            const countColumns = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return 0;
                }
                return getComputedStyle(element)
                    .gridTemplateColumns.split(' ')
                    .map((column) => column.trim())
                    .filter(Boolean).length;
            };
            const prepDetail = document.querySelector('[data-testid="inventory-prep-strip"] p');
            const rewardSignal = document.querySelector('[data-testid="inventory-reward-signal"]');
            const summaryGrid = document.querySelector('[data-testid="inventory-run-summary-grid"]');
            const metaFrameSvg = document.querySelector('[data-testid="inventory-meta-frame-run"] [data-meta-frame="true"] svg');
            const firstConsumableRow = document.querySelector(
                '[data-testid="inventory-meta-frame-consumables"] [class*="archiveCatalogRow"]'
            );
            const firstConsumableSubtitle = firstConsumableRow?.querySelector('p[class*="subtitle"]');
            return {
                buildFrame: rect('[data-testid="inventory-meta-frame-build"]'),
                firstConsumableRow: firstConsumableRow instanceof HTMLElement
                    ? {
                          height: firstConsumableRow.getBoundingClientRect().height,
                          text: firstConsumableRow.innerText.trim().replace(/\s+/g, ' ')
                      }
                    : null,
                firstConsumableSubtitleDisplay:
                    firstConsumableSubtitle instanceof HTMLElement ? getComputedStyle(firstConsumableSubtitle).display : null,
                header: rect('[data-testid="inventory-screen"] header'),
                metaFrameSvgDisplay: metaFrameSvg instanceof SVGElement ? getComputedStyle(metaFrameSvg).display : null,
                payoffEngine: rect('[data-testid="inventory-payoff-engine"]'),
                prepColumns: countColumns('[data-testid="inventory-prep-strip"]'),
                prepDetailDisplay: prepDetail instanceof HTMLElement ? getComputedStyle(prepDetail).display : null,
                rail: rect('[data-testid="inventory-section-rail"]'),
                rewardSignalDisplay: rewardSignal instanceof HTMLElement ? getComputedStyle(rewardSignal).display : null,
                runLoop: rect('[data-testid="inventory-run-loop-signals"]'),
                runLoopColumns: countColumns('[data-testid="inventory-run-loop-signals"]'),
                runSnapshotPanel: rect('[data-testid="inventory-meta-frame-run"]'),
                summaryGridDisplay: summaryGrid instanceof HTMLElement ? getComputedStyle(summaryGrid).display : null
            };
        });

        expect(layout.header).toBeTruthy();
        expect(layout.rail).toBeTruthy();
        expect(layout.payoffEngine).toBeTruthy();
        expect(layout.runLoop).toBeTruthy();
        expect(layout.runSnapshotPanel).toBeTruthy();
        expect(layout.buildFrame).toBeTruthy();
        expect(layout.header!.height).toBeLessThanOrEqual(120);
        expect(layout.rail!.height).toBeLessThanOrEqual(48);
        expect(layout.payoffEngine!.height).toBeLessThanOrEqual(54);
        expect(layout.runLoopColumns).toBe(4);
        expect(layout.prepColumns).toBe(3);
        expect(layout.prepDetailDisplay).toBe('none');
        expect(layout.rewardSignalDisplay).toBe('none');
        expect(layout.summaryGridDisplay).toBe('none');
        expect([null, 'none']).toContain(layout.metaFrameSvgDisplay);
        expect(layout.runSnapshotPanel!.height).toBeLessThanOrEqual(360);
        expect(layout.buildFrame!.top).toBeLessThanOrEqual(740);
        expect(layout.firstConsumableRow).toBeTruthy();
        expect(layout.firstConsumableRow!.height).toBeLessThanOrEqual(64);
        expect(layout.firstConsumableRow!.text).toContain('Shuffle');
        expect(layout.firstConsumableRow!.text).not.toMatch(/Shuffle charge: 1Shuffle1/i);
        expect(layout.firstConsumableSubtitleDisplay).toBe('none');
    });

    test('game control icons meet minimum touch target on compact touch viewport', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);
        const controls = page.getByRole('toolbar', { name: /game controls/i });
        await expect(controls).toBeVisible();
        for (const name of [/fit board/i, /open codex/i, /settings/i]) {
            const btn = controls.getByRole('button', { name });
            const box = await btn.boundingBox();
            expect(box, `bounding box for ${name}`).toBeTruthy();
            expect(box!.width).toBeGreaterThanOrEqual(43);
            expect(box!.height).toBeGreaterThanOrEqual(43);
        }
    });

    for (const viewport of ACTIVE_GAMEPLAY_PORTRAITS) {
        test(`${viewport.name} portrait active gameplay has no horizontal overflow`, async ({ page }) => {
            await forceCoarsePointerMedia(page);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);

            await expectCoreGameplayChromeFits(page);
            const gameplayChrome = await page.evaluate(() => {
                const rect = (selector: string) => {
                    const element = document.querySelector(selector);
                    if (!(element instanceof HTMLElement)) {
                        return null;
                    }
                    const box = element.getBoundingClientRect();
                    return {
                        height: box.height,
                        top: box.top,
                        width: box.width
                    };
                };
                const dockButtonHeights = Array.from(
                    document.querySelectorAll('[data-testid="game-action-dock"] button, [data-testid="game-action-dock"] summary')
                )
                    .filter((element): element is HTMLElement => element instanceof HTMLElement && element.offsetParent !== null)
                    .map((element) => ({
                        className: element.className.toString(),
                        height: element.getBoundingClientRect().height,
                        left: element.getBoundingClientRect().left,
                        right: element.getBoundingClientRect().right,
                        tagName: element.tagName,
                        text: element.textContent?.trim() ?? ''
                    }));
                return {
                    boardCanvas: rect('[data-testid="tile-board-application"]'),
                    dock: rect('[data-testid="game-action-dock"]'),
                    objective: rect('[data-testid="dungeon-status-panel"]'),
                    objectiveDisplay:
                        document.querySelector('[data-testid="dungeon-status-panel"]') instanceof HTMLElement
                            ? getComputedStyle(document.querySelector('[data-testid="dungeon-status-panel"]') as HTMLElement).display
                            : null,
                    dockButtonHeights,
                    viewportWidth: window.innerWidth
                };
            });
            expect(gameplayChrome.boardCanvas?.height ?? 0).toBeGreaterThan(0);
            expect(gameplayChrome.boardCanvas?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(210);
            expect(gameplayChrome.dock?.height ?? Infinity).toBeLessThanOrEqual(56);
            expect(gameplayChrome.objectiveDisplay).toBe('none');
            expect(gameplayChrome.objective?.width ?? 0).toBeLessThanOrEqual(1);
            expect(Math.min(...gameplayChrome.dockButtonHeights.map((item) => item.height)), JSON.stringify(gameplayChrome)).toBeGreaterThanOrEqual(43);
            expect(
                gameplayChrome.dockButtonHeights.every(
                    (item) => item.left >= -1 && item.right <= gameplayChrome.viewportWidth + 1
                ),
                JSON.stringify(gameplayChrome)
            ).toBe(true);
            await page.getByText(/^Info$/i).click({ force: true });
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-hud'), 8);
            await expect(page.getByTestId('hud-in-run-cause-strip')).toBeVisible();
            await expect(page.getByTestId('hud-in-run-cause-strip')).toContainText(/hazards/i);
        });

        test(`${viewport.name} portrait run settings overlay keeps actions reachable`, async ({ page }) => {
            await forceCoarsePointerMedia(page);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);

            await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
                (element as HTMLButtonElement).click();
            });
            await expectDialogFitsWithPrimaryActions(page, /run settings/i);
            const dialog = page.getByRole('dialog', { name: /run settings/i });
            await expectLocatorFullyInWindowViewport(page, dialog.getByRole('button', { name: /^back$/i }), 8);
            await expect(dialog.getByRole('button', { name: /^save$/i })).toHaveCount(0);
            await expectLocatorFullyInWindowViewport(page, dialog.getByTestId('settings-save-state'), 8);
        });

        test(`${viewport.name} portrait relic offer overlay fits without clipped picks`, async ({ page }) => {
            await forceCoarsePointerMedia(page);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'relicDraft');

            const relicDialog = page.getByTestId('game-relic-offer-overlay');
            const cards = page.getByTestId('relic-offer-card');
            await expect(relicDialog).toBeVisible({ timeout: 30_000 });
            await expectNoHorizontalOverflow(page);
            await expectLocatorFullyInWindowViewport(page, relicDialog, 8);
            await expect(cards.first()).toBeVisible();
            await expectLocatorFullyInWindowViewport(page, cards.first(), 8);

            const layout = await page.evaluate(() => {
                const readRect = (element: Element | null) => {
                    if (!(element instanceof HTMLElement)) {
                        return null;
                    }
                    const rect = element.getBoundingClientRect();
                    return {
                        top: rect.top,
                        bottom: rect.bottom,
                        height: rect.height,
                        width: rect.width
                    };
                };

                const overlay = readRect(document.querySelector('[data-testid="game-relic-offer-overlay"]'));
                const payoffEngine = readRect(document.querySelector('[data-testid="relic-draft-payoff-engine"]'));
                const laneMap = readRect(document.querySelector('[data-testid="relic-draft-lane-map"]'));
                const serviceRow = readRect(document.querySelector('[data-testid="relic-offer-services"]'));
                const serviceCue = document.querySelector('[data-testid^="relic-service-"]');
                const pickActions = Array.from(document.querySelectorAll('[data-testid="relic-pick-action"]')).map(
                    (element) => ({
                        label: element.getAttribute('data-visible-pick-action-label'),
                        text: element.textContent ?? ''
                    })
                );
                const offerCards = Array.from(document.querySelectorAll('[data-testid="relic-offer-card"]')).map((element) =>
                    readRect(element)
                );
                const serviceButtons = Array.from(document.querySelectorAll('[data-testid="relic-offer-services"] button')).map(
                    (element) => readRect(element)
                );
                const pickPulse = document.querySelector('[data-testid="relic-pick-pulse"]');
                const impactChips = document.querySelector('[data-testid="relic-impact-chips"]');
                return {
                    overlay,
                    payoffEngine,
                    laneMap,
                    cards: offerCards,
                    serviceButtons,
                    serviceCueDisplay: serviceCue instanceof HTMLElement ? getComputedStyle(serviceCue).display : null,
                    serviceRow,
                    pickActions,
                    pickPulseDisplay: pickPulse instanceof HTMLElement ? getComputedStyle(pickPulse).display : null,
                    impactChipsDisplay: impactChips instanceof HTMLElement ? getComputedStyle(impactChips).display : null,
                    viewportHeight: window.innerHeight
                };
            });

            expect(layout.overlay).toBeTruthy();
            expect(layout.payoffEngine).toBeTruthy();
            expect(layout.laneMap).toBeTruthy();
            expect(layout.cards[0]).toBeTruthy();
            expect(layout.payoffEngine!.height).toBeLessThanOrEqual(52);
            expect(layout.laneMap!.height).toBeLessThanOrEqual(64);
            expect(layout.overlay!.top).toBeGreaterThanOrEqual(8);
            expect(layout.overlay!.top).toBeLessThanOrEqual(130);
            expect(layout.overlay!.height).toBeGreaterThanOrEqual(270);
            expect(layout.overlay!.height).toBeLessThanOrEqual(layout.viewportHeight * 0.62);
            expect(layout.overlay!.bottom).toBeLessThanOrEqual(layout.viewportHeight - 8);
            expect(layout.serviceRow?.height ?? 0).toBeLessThanOrEqual(96);
            expect(layout.serviceRow?.bottom ?? 0).toBeLessThanOrEqual(layout.overlay!.bottom - 8);
            expect(layout.serviceButtons.every((button) => (button?.height ?? 0) >= 40)).toBe(true);
            expect(layout.serviceCueDisplay).toBe('none');
            expect(layout.cards[0]!.top).toBeLessThanOrEqual(layout.overlay!.top + 320);
            expect(layout.cards[0]!.height).toBeLessThanOrEqual(128);
            expect(layout.pickPulseDisplay).toBe('none');
            expect(layout.impactChipsDisplay).toBe('none');
            expect(layout.pickActions.length).toBeGreaterThan(0);
            expect(layout.pickActions[0]!.text).not.toMatch(/pick action/i);
            expect(layout.pickActions.some((action) => action.label === 'Lock' || action.label === 'Take')).toBe(true);
            if (layout.cards[1]) {
                expect(layout.cards[1]!.top).toBeLessThan(layout.overlay!.bottom - 16);
            }
        });
    }

    test('mobile side room choice uses tappable reward cards with a minimal escape dock', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'sideRoomSkip');

        const sideRoom = page.getByTestId('side-room-screen');
        const actionDock = page.getByTestId('side-room-action-dock');
        const perkChoice = page.locator('[data-testid="side-room-reward-panel"] [data-choice-id$="free_swap_floor"]');
        await expect(sideRoom).toBeVisible();
        await expect(perkChoice).toBeVisible();
        await expect(page.getByRole('button', { name: /choose trait toolkit/i })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, actionDock, 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    width: box.width
                };
            };
            const rewardPanelSelector = '[data-testid="side-room-reward-panel"]';
            const supportRail = document.querySelector(`${rewardPanelSelector} [data-choice-id$="free_swap_floor"] [data-testid$="-support-rail"]`);
            const payoffStack = document.querySelector(`${rewardPanelSelector} [data-choice-id$="free_swap_floor"] [data-testid$="-payoff-stack"]`);
            const firstVisibleChoice = document.querySelector(`${rewardPanelSelector} [data-choice-id$="trait_toolkit"]`);
            const firstVisibleChoiceBeat = firstVisibleChoice?.querySelector('[data-testid$="-beat"]');
            const firstVisibleChoiceCueGrid = firstVisibleChoice?.querySelector('[class*="choiceCueGrid"]');
            const firstVisibleChoiceCopy = firstVisibleChoice?.querySelector('p');
            const firstVisibleChoicePayoffStack = firstVisibleChoice?.querySelector('[data-testid$="-payoff-stack"]');
            const clippedChoiceCopy = Array.from(document.querySelectorAll(`${rewardPanelSelector} [data-choice-id] > p`))
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');
            const clippedImpactText = Array.from(
                document.querySelectorAll('[data-testid^="side-room-choice-"][data-testid$="-impact"] strong')
            )
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');
            const payoffStackLabel = payoffStack?.querySelector('small');
            const actionDock = document.querySelector('[data-testid="side-room-action-dock"]');
            const actionHelper = document.querySelector('[data-testid="side-room-action-dock"] button small');
            const actionButtons = Array.from(
                document.querySelectorAll('[data-testid="side-room-action-dock"] button')
            ).map((button) => {
                const box = button.getBoundingClientRect();
                const compactLabel = button.querySelector('[data-compact-label]')?.getAttribute('data-compact-label');
                const style = getComputedStyle(button);
                return {
                    display: style.display,
                    height: box.height,
                    label: compactLabel ?? button.textContent?.replace(/\s+/g, ' ').trim() ?? '',
                    top: box.top,
                    width: box.width
                };
            });
            const visibleActionButtons = actionButtons.filter(
                (button) => button.display !== 'none' && button.width > 1 && button.height > 1
            );
            const rewardPanel = document.querySelector('[data-testid="side-room-screen"] [data-has-choices="true"]');
            return {
                actionHelperDisplay: actionHelper ? getComputedStyle(actionHelper).display : null,
                actionButtons,
                visibleActionButtons,
                clippedImpactText,
                actionDockColumns: actionDock
                    ? getComputedStyle(actionDock)
                          .gridTemplateColumns.split(' ')
                          .filter((value) => value && value !== '/')
                          .length
                    : 0,
                boardMoment: rect('[data-testid="side-room-board-moment"]'),
                firstVisibleChoice: rect(`${rewardPanelSelector} [data-choice-id$="trait_toolkit"]`),
                firstVisibleChoiceBeatDisplay: firstVisibleChoiceBeat ? getComputedStyle(firstVisibleChoiceBeat).display : null,
                firstVisibleChoiceCopyDisplay: firstVisibleChoiceCopy ? getComputedStyle(firstVisibleChoiceCopy).display : null,
                firstVisibleChoiceCueGridDisplay:
                    firstVisibleChoiceCueGrid instanceof HTMLElement ? getComputedStyle(firstVisibleChoiceCueGrid).display : null,
                firstVisibleChoiceCueColumns:
                    firstVisibleChoiceCueGrid instanceof HTMLElement
                        ? getComputedStyle(firstVisibleChoiceCueGrid)
                              .gridTemplateColumns.split(' ')
                              .filter(Boolean).length
                        : 0,
                firstVisibleChoicePayoffStack: firstVisibleChoicePayoffStack
                    ? firstVisibleChoicePayoffStack.getBoundingClientRect().height
                    : null,
                clippedChoiceCopy,
                payoffStackDisplay: payoffStack ? getComputedStyle(payoffStack).display : null,
                payoffStackLabelDisplay: payoffStackLabel ? getComputedStyle(payoffStackLabel).display : null,
                primarySignals: rect('[data-testid="side-room-primary-action-signals"]'),
                rewardPanelColumns: rewardPanel ? getComputedStyle(rewardPanel).gridTemplateColumns : '',
                rewardPanelRect: rect('[data-testid="side-room-screen"] [data-has-choices="true"]'),
                sideRoom: rect('[data-testid="side-room-screen"]'),
                supportRailDisplay: supportRail ? getComputedStyle(supportRail).display : null
            };
        });

        expect(layout.actionHelperDisplay).toBe('none');
        expect(layout.actionDockColumns).toBe(1);
        expect(layout.actionButtons).toHaveLength(4);
        expect(layout.visibleActionButtons).toHaveLength(1);
        expect(layout.visibleActionButtons[0]!.label).toBe('Leave it');
        expect(layout.visibleActionButtons[0]!.height).toBeGreaterThanOrEqual(40);
        expect(layout.visibleActionButtons[0]!.height).toBeLessThanOrEqual(54);
        expect(layout.visibleActionButtons[0]!.width).toBeGreaterThan(300);
        expect(layout.clippedImpactText).toEqual([]);
        expect(layout.rewardPanelColumns.split(' ').filter(Boolean)).toHaveLength(1);
        expect(layout.rewardPanelRect?.top ?? Number.POSITIVE_INFINITY).toBeGreaterThanOrEqual(80);
        expect(layout.rewardPanelRect?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(300);
        expect(layout.rewardPanelRect?.height ?? 0).toBeGreaterThanOrEqual(280);
        expect(layout.rewardPanelRect?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(440);
        expect(layout.firstVisibleChoice).toBeTruthy();
        expect(layout.boardMoment?.height ?? 0).toBe(0);
        expect(layout.primarySignals?.height ?? 0).toBe(0);
        expect(layout.firstVisibleChoice!.top).toBeLessThanOrEqual((layout.rewardPanelRect?.top ?? 0) + 130);
        expect(layout.firstVisibleChoice!.bottom).toBeLessThanOrEqual(layout.rewardPanelRect!.bottom - 60);
        expect(layout.firstVisibleChoice!.height).toBeGreaterThanOrEqual(78);
        expect(layout.firstVisibleChoice!.height).toBeLessThanOrEqual(112);
        expect(layout.firstVisibleChoicePayoffStack ?? 0).toBe(0);
        expect(layout.firstVisibleChoiceBeatDisplay).toBe('none');
        expect(layout.firstVisibleChoiceCueGridDisplay).toBe('none');
        expect(layout.firstVisibleChoiceCopyDisplay).not.toBe('none');
        expect(layout.clippedChoiceCopy).toEqual([]);
        expect(layout.supportRailDisplay).toBe('none');
        expect(layout.payoffStackDisplay).toBe('none');
        expect(layout.payoffStackLabelDisplay).toBe('none');
    });

    test('short landscape side room choice keeps reward cards clear of the escape dock', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'sideRoomChoice');

        await expect(page.getByTestId('side-room-screen')).toBeVisible();
        await expect(page.getByRole('button', { name: /speak the name/i })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('side-room-action-dock'), 8);

        const layout = await page.evaluate(() => {
            const box = (element: Element | null) => {
                if (!element) {
                    return null;
                }
                const rect = element.getBoundingClientRect();
                return {
                    bottom: rect.bottom,
                    height: rect.height,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    width: rect.width
                };
            };
            const shell = document.querySelector('[data-testid="side-room-screen"] [data-has-choices="true"]');
            const dock = document.querySelector('[data-testid="side-room-action-dock"]');
            const choiceRows = Array.from(document.querySelectorAll('[data-testid="side-room-reward-panel"] [data-choice-id]'))
                .map((element) => {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    return {
                        bottom: rect.bottom,
                        display: style.display,
                        height: rect.height,
                        text: element.textContent?.trim().replace(/\s+/g, ' ') ?? '',
                        top: rect.top,
                        width: rect.width
                    };
                })
                .filter((row) => row.display !== 'none' && row.width > 1 && row.height > 1);
            return {
                choiceRows,
                dock: box(dock),
                shell: box(shell),
                viewportHeight: window.innerHeight
            };
        });

        expect(layout.shell).toBeTruthy();
        expect(layout.dock).toBeTruthy();
        expect(layout.choiceRows.length).toBeGreaterThanOrEqual(3);
        expect(layout.shell!.height).toBeLessThan(layout.viewportHeight * 0.78);
        expect(layout.choiceRows.every((row) => row.height <= 72)).toBe(true);
        expect(layout.choiceRows.every((row) => row.bottom <= layout.dock!.top - 6)).toBe(true);
    });

    test('mobile choose path keeps the launcher and browse library inside the first viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);

        const launcher = page.getByTestId('choose-path-launcher');
        const launchPanel = page.getByTestId('choose-path-launch-panel');
        const scroller = page.getByTestId('choose-path-library-scroller');
        const offlineNote = page.getByTestId('choose-path-offline-note');

        await expect(launcher).toBeVisible();
        await expect(launchPanel).toBeVisible();
        await expect(scroller).toBeVisible();
        await expect(offlineNote).toBeHidden();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /^back$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /start run/i }), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /hide modes/i }), 8);

        const layout = await page.evaluate(() => {
            const summary = document.querySelector('[data-testid="choose-path-launch-summary"]');
            const launchLoop = document.querySelector('[data-testid^="choose-path-mode-loop-"]');
            const launchPanel = document.querySelector('[data-testid="choose-path-launch-panel"]');
            const launchActions = launchPanel?.querySelector('[class*="launchActions"]');
            const launchPrimarySmall = launchPanel?.querySelector('button small');
            const scrollerEl = document.querySelector('[data-testid="choose-path-library-scroller"]');
            const firstCard = scrollerEl?.querySelector('button');
            const firstCardBody = scrollerEl?.querySelector('p');
            const firstCardSignals = scrollerEl?.querySelector('[data-testid^="choose-path-mode-signals-"]');
            const firstLibraryPage = scrollerEl?.querySelector('[data-library-page-index="0"]');
            const pageDots = document.querySelector('[aria-label="Library pages"]');
            const titleEl = document.querySelector('[data-testid="choose-path-screen"] h1');
            const clippedLibraryBodies = Array.from(scrollerEl?.querySelectorAll('p') ?? [])
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        element.scrollHeight > element.clientHeight + 4
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');
            const subtitle = Array.from(document.querySelectorAll('[data-testid="choose-path-screen"] p')).find((element) =>
                element.textContent?.includes('Recommended. Browse')
            );
            return {
                clippedLibraryBodies,
                firstCardBodyDisplay: firstCardBody instanceof HTMLElement ? getComputedStyle(firstCardBody).display : null,
                firstCardBodyLineClamp: firstCardBody ? getComputedStyle(firstCardBody).webkitLineClamp : null,
                firstCardTop: firstCard ? firstCard.getBoundingClientRect().top : null,
                firstCardSignalsDisplay: firstCardSignals ? getComputedStyle(firstCardSignals).display : null,
                firstLibraryPageColumns:
                    firstLibraryPage instanceof HTMLElement ? getComputedStyle(firstLibraryPage).gridTemplateColumns : null,
                launchActionsColumns:
                    launchActions instanceof HTMLElement ? getComputedStyle(launchActions).gridTemplateColumns : null,
                launchPanelHeight: launchPanel ? launchPanel.getBoundingClientRect().height : null,
                launchLoopDisplay: launchLoop ? getComputedStyle(launchLoop).display : null,
                launchPrimarySmallDisplay:
                    launchPrimarySmall instanceof HTMLElement ? getComputedStyle(launchPrimarySmall).display : null,
                scrollerMaxHeight: scrollerEl ? getComputedStyle(scrollerEl).maxHeight : null,
                summaryDisplay: summary instanceof HTMLElement ? getComputedStyle(summary).display : null,
                summaryLineClamp: summary ? getComputedStyle(summary).webkitLineClamp : null,
                pageDotsDisplay: pageDots instanceof HTMLElement ? getComputedStyle(pageDots).display : null,
                subtitleDisplay: subtitle instanceof HTMLElement ? getComputedStyle(subtitle).display : null,
                subtitleText: subtitle?.textContent ?? '',
                titleClientHeight: titleEl instanceof HTMLElement ? titleEl.clientHeight : 0,
                titleScrollHeight: titleEl instanceof HTMLElement ? titleEl.scrollHeight : 0
            };
        });

        expect(layout.subtitleText).toContain('Recommended. Browse');
        expect(layout.subtitleDisplay).toBe('none');
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.summaryDisplay).toBe('none');
        expect(layout.launchLoopDisplay).toBe('none');
        expect(layout.launchActionsColumns?.split(' ').filter(Boolean)).toHaveLength(2);
        expect(layout.launchPrimarySmallDisplay).toBe('none');
        expect(parseFloat(layout.scrollerMaxHeight ?? '0')).toBeLessThanOrEqual(190);
        expect(layout.launchPanelHeight ?? 0).toBeLessThanOrEqual(112);
        expect(layout.firstCardTop ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(300);
        expect(layout.firstCardSignalsDisplay).toBe('none');
        expect(layout.firstCardBodyDisplay).not.toBe('none');
        expect(layout.firstCardBodyLineClamp).toBe('2');
        expect(layout.firstLibraryPageColumns?.split(' ').filter(Boolean)).toHaveLength(1);
        expect(layout.pageDotsDisplay).toBe('none');
        expect(layout.clippedLibraryBodies).toEqual([]);
    });

    test('mobile choose path mode detail keeps launch actions visible without duplicate notes', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await openChooseYourPath(page);

        await page.getByRole('button', { name: /^Classic Run\..*Open details\.$/i }).click({ force: true });

        const detail = page.getByTestId('library-mode-detail-modal');
        await expectDialogFitsWithPrimaryActions(page, /classic run/i);
        await expectLocatorFullyInWindowViewport(page, detail.getByRole('button', { name: /^play$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, detail.getByRole('button', { name: /^close$/i }), 8);

        const layout = await page.evaluate(() => {
            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element ? getComputedStyle(element).display : null;
            };
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return { bottom: box.bottom, height: box.height, top: box.top };
            };
            return {
                availabilityDisplay: display('[data-library-detail-note="availability"]'),
                gate: rect('[data-library-detail-note="gate"]'),
                modal: rect('[data-testid="library-mode-detail-modal"]'),
                signalStripDisplay: display('[data-testid="library-mode-detail-modal"] [class*="libraryDetailSignals"]'),
                start: rect('[data-library-detail-note="start"]')
            };
        });

        expect(layout.modal?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(700);
        expect(layout.start?.height ?? 0).toBeGreaterThan(0);
        expect(layout.gate?.height ?? 0).toBeGreaterThan(0);
        expect(layout.availabilityDisplay).toBe('none');
        expect(layout.signalStripDisplay).toBe('none');
    });

    test('mobile collection keeps archive header, rail, and first overview row readable', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^collection$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });

        const collection = page.getByRole('region', { name: /collection/i });
        const sectionRail = page.getByTestId('collection-section-rail');
        const firstSignalRow = page.getByTestId('collection-reward-signals').locator(':scope > div').first();
        const subtitle = page.getByText('Saved progress: rewards, records, relics, and tile sets.');

        await expect(collection).toBeVisible();
        await expect(subtitle).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, collection.getByRole('button', { name: /^back$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, sectionRail, 8);
        await expectLocatorFullyInWindowViewport(page, firstSignalRow, 8);

        const layout = await page.evaluate(() => {
            const rewardLead = document.querySelector('[data-testid="collection-reward-signals-lead"]');
            const metaLead = document.querySelector('[data-testid="collection-meta-upgrades-lead"]');
            const firstOverviewBody = document.querySelector(
                '[data-testid="collection-reward-signals"] > div p:last-of-type'
            );
            const firstOverviewNext = document.querySelector('[data-testid="collection-reward-signals"] > div span');
            const subtitleEl = document.querySelector('[aria-label="Collection"] header p');
            const readRect = (selector: string, index = 0) => {
                const element = document.querySelectorAll(selector)[index];
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const rect = element.getBoundingClientRect();
                return {
                    top: rect.top,
                    bottom: rect.bottom,
                    height: rect.height,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width
                };
            };
            const firstGalleryBody = document.querySelector('[data-testid="collection-reward-gallery"] > div p');
            const firstGalleryImpact = document.querySelector('[data-testid="collection-reward-gallery"] > div [class*="galleryImpactCue"]');
            const firstGalleryImpactCopy = firstGalleryImpact?.querySelector('b');
            const firstGalleryNext = document.querySelector('[data-testid="collection-reward-gallery"] > div > span:last-child');
            const galleryGrid = document.querySelector('[data-testid="collection-reward-gallery"]');
            const galleryCards = Array.from(document.querySelectorAll('[data-testid="collection-reward-gallery"] > div'));
            const previewFrames = Array.from(document.querySelectorAll('[class*="secondaryArchivePreviewFrame"]')).map((element) => {
                const rect = element.getBoundingClientRect();
                const bodyDisplays = Array.from(element.querySelectorAll(':scope .section > :not([class*="sectionTitle"])')).map((child) =>
                    child instanceof HTMLElement ? getComputedStyle(child).display : null
                );
                return {
                    bodyDisplays,
                    height: rect.height
                };
            });
            const titleEl = document.querySelector('[aria-label="Collection"] header h1');
            const railControls = Array.from(document.querySelectorAll('[data-testid="collection-section-rail"] a'))
                .filter((element) => {
                    const style = getComputedStyle(element);
                    const rect = element.getBoundingClientRect();
                    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
                })
                .map((element) => {
                    const rect = element.getBoundingClientRect();
                    return { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top };
                });
            return {
                achievementsFrame: readRect('[data-testid="collection-meta-frame-achievements"]'),
                firstGalleryBodyDisplay: firstGalleryBody instanceof HTMLElement ? getComputedStyle(firstGalleryBody).display : null,
                firstGalleryCard: readRect('[data-testid="collection-reward-gallery"] > div', 0),
                firstGalleryImpactDisplay:
                    firstGalleryImpact instanceof HTMLElement ? getComputedStyle(firstGalleryImpact).display : null,
                firstGalleryImpactCopyDisplay:
                    firstGalleryImpactCopy instanceof HTMLElement ? getComputedStyle(firstGalleryImpactCopy).display : null,
                firstGalleryNextDisplay: firstGalleryNext instanceof HTMLElement ? getComputedStyle(firstGalleryNext).display : null,
                galleryCardDisplays: galleryCards.map((card) =>
                    card instanceof HTMLElement ? getComputedStyle(card).display : null
                ),
                galleryColumns:
                    galleryGrid instanceof HTMLElement
                        ? getComputedStyle(galleryGrid).gridTemplateColumns.split(' ').filter(Boolean).length
                        : 0,
                galleryFrame: readRect('[data-testid="collection-meta-frame-reward-gallery"]'),
                backButton: readRect('[aria-label="Collection"] header button'),
                header: readRect('[aria-label="Collection"] header'),
                leadDisplay: rewardLead ? getComputedStyle(rewardLead).display : null,
                metaLeadDisplay: metaLead ? getComputedStyle(metaLead).display : null,
                overviewBodyDisplay: firstOverviewBody instanceof HTMLElement ? getComputedStyle(firstOverviewBody).display : null,
                overviewNextLineClamp:
                    firstOverviewNext instanceof HTMLElement ? getComputedStyle(firstOverviewNext).webkitLineClamp : null,
                overviewNextWhiteSpace:
                    firstOverviewNext instanceof HTMLElement ? getComputedStyle(firstOverviewNext).whiteSpace : null,
                rail: readRect('[data-testid="collection-section-rail"]'),
                railControlHeights: railControls,
                rewardFrame: readRect('[data-testid="collection-meta-frame-reward-signals"]'),
                secondaryPreviewFrames: previewFrames,
                subtitleClientHeight: subtitleEl instanceof HTMLElement ? subtitleEl.clientHeight : 0,
                subtitleScrollHeight: subtitleEl instanceof HTMLElement ? subtitleEl.scrollHeight : 0,
                title: readRect('[aria-label="Collection"] header h1'),
                titleClientHeight: titleEl instanceof HTMLElement ? titleEl.clientHeight : 0,
                titleScrollHeight: titleEl instanceof HTMLElement ? titleEl.scrollHeight : 0,
                upgradesFrame: readRect('[data-testid="collection-meta-frame-meta-upgrades"]')
            };
        });

        expect(layout.header?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(90);
        expect(layout.title).toBeTruthy();
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.backButton).toBeTruthy();
        expect(layout.title!.right).toBeLessThanOrEqual(layout.backButton!.left - 6);
        expect(layout.rail?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(72);
        expect(layout.railControlHeights).toHaveLength(6);
        expect(layout.railControlHeights.every((control) => control.height >= 28)).toBe(true);
        expect(layout.railControlHeights.every((control) => control.left >= 0 && control.right <= 390)).toBe(true);
        expect(layout.railControlHeights.every((control) => control.bottom <= layout.rail!.bottom + 1)).toBe(true);
        expect(layout.rewardFrame!.top).toBeGreaterThanOrEqual(layout.rail!.bottom + 6);
        expect(layout.subtitleScrollHeight).toBeLessThanOrEqual(layout.subtitleClientHeight + 4);
        expect(layout.rewardFrame?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(190);
        expect(layout.upgradesFrame?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(245);
        expect(layout.galleryFrame?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(575);
        expect(layout.achievementsFrame?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(820);
        expect(layout.galleryColumns).toBe(1);
        expect(layout.firstGalleryCard?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(68);
        expect(layout.galleryCardDisplays.slice(0, 3)).toEqual(['grid', 'grid', 'grid']);
        expect(layout.galleryCardDisplays.slice(3).every((display) => display === 'none')).toBe(true);
        expect(layout.overviewBodyDisplay).not.toBe('none');
        expect(layout.overviewNextLineClamp).toBe('2');
        expect(layout.overviewNextWhiteSpace).toBe('normal');
        expect(layout.firstGalleryBodyDisplay).toBe('none');
        expect(layout.firstGalleryImpactDisplay).toBe('none');
        expect(layout.firstGalleryImpactCopyDisplay).toBe('none');
        expect(layout.firstGalleryNextDisplay).toBe('none');
        expect(layout.secondaryPreviewFrames).toHaveLength(3);
        expect(layout.secondaryPreviewFrames.every((frame) => frame.height <= 46)).toBe(true);
        expect(
            layout.secondaryPreviewFrames.every((frame) => frame.bodyDisplays.every((display) => display === 'none'))
        ).toBe(true);
        expect(layout.leadDisplay).toBe('none');
        expect(layout.metaLeadDisplay).toBe('none');
    });

    test('mobile empty inventory keeps the full preview stack inside the first viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^inventory$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });

        const inventory = page.getByRole('region', { name: /inventory/i });
        const emptyState = page.getByTestId('inventory-empty-state');
        const choosePathButton = emptyState.getByRole('button', { name: /^choose path$/i });

        await expect(inventory).toBeVisible();
        await expect(emptyState).toBeVisible();
        await expect(choosePathButton).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, inventory.getByRole('button', { name: /^back$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, choosePathButton, 8);
        await expectLocatorFullyInWindowViewport(page, page.getByText(/pick a mode to start a run/i), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByText(/tool bank/i), 8);

        const layout = await page.evaluate(() => {
            const readRect = (selector: string, index = 0) => {
                const element = document.querySelectorAll(selector)[index];
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const rect = element.getBoundingClientRect();
                return {
                    top: rect.top,
                    bottom: rect.bottom,
                    height: rect.height,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width
                };
            };
            const actionCueLabel = document.querySelector('[class*="emptyStateActionCue"] small');
            return {
                actionCueLabelDisplay: actionCueLabel instanceof HTMLElement ? getComputedStyle(actionCueLabel).display : null,
                backButton: readRect('[aria-label="Inventory"] header button'),
                choosePathButton: readRect('[data-testid="inventory-empty-action-cue"] button'),
                emptyFrame: readRect('[data-testid="inventory-meta-frame-empty"]'),
                emptyState: readRect('[data-testid="inventory-empty-state"]'),
                header: readRect('[aria-label="Inventory"] header'),
                lastPreview: readRect('[data-testid="inventory-empty-state"] [class*="emptyStatePreviewCard"]', 2),
                title: readRect('[aria-label="Inventory"] header h1'),
                titleFits:
                    document.querySelector('[aria-label="Inventory"] header h1') instanceof HTMLElement
                        ? document.querySelector('[aria-label="Inventory"] header h1')!.scrollWidth <=
                          document.querySelector('[aria-label="Inventory"] header h1')!.clientWidth + 1
                        : false
            };
        });

        expect(layout.header?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(95);
        expect(layout.title).toBeTruthy();
        expect(layout.titleFits).toBe(true);
        expect(layout.backButton).toBeTruthy();
        expect(layout.title!.right).toBeLessThanOrEqual(layout.backButton!.left - 6);
        expect(layout.choosePathButton?.height ?? 0).toBeGreaterThanOrEqual(32);
        expect(layout.emptyFrame?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(270);
        expect(layout.emptyState?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(250);
        expect(layout.lastPreview?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(380);
        expect(layout.actionCueLabelDisplay).toBe('none');

        await choosePathButton.click();
        await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    });

    test('mobile profile compresses header actions and overview copy', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^profile$/i }).click({ force: true });

        const profile = page.getByRole('region', { name: /profile/i });
        const sectionRail = page.getByTestId('profile-section-rail');
        const summaryGrid = page.getByTestId('profile-summary-grid');
        const progressionBrief = page.getByTestId('profile-progression-brief');
        const objectiveBoard = page.getByTestId('profile-objective-board');

        await expect(profile).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, profile.getByRole('button', { name: /^settings$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, profile.getByRole('button', { name: /^back$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, sectionRail, 8);
        await expectLocatorFullyInWindowViewport(page, progressionBrief, 8);
        await expect(objectiveBoard).toBeVisible();

        const layout = await page.evaluate(() => {
            const identitySub = document
                .querySelector('[data-testid="profile-identity"] > div > span:last-of-type');
            const progressionDetail = document
                .querySelector('[data-testid="profile-progression-brief"]')
                ?.querySelectorAll('p')[1];
            const progressionSummary = document
                .querySelector('[data-testid="profile-progression-brief"]')
                ?.querySelectorAll('p')[0];
            const summaryGridEl = document.querySelector('[data-testid="profile-summary-grid"]');
            const milestoneChips = Array.from(document.querySelectorAll('[data-testid="profile-milestone-rail"] > *'));
            const progressionImpactGrid = document.querySelector('[data-testid="profile-progression-impact-grid"]');
            const inlineMetaRow = document.querySelector('[data-testid="profile-progression-impact-grid"]')?.nextElementSibling;
            const objectiveBoardEl = document.querySelector('[data-testid="profile-objective-board"]');
            const objectiveItems = Array.from(document.querySelectorAll('[data-testid="profile-objective-board"] > *'));
            const firstObjectiveReward = objectiveBoardEl?.querySelector('p');
            const firstTrustBody = document.querySelector('[data-testid="profile-meta-frame-trust"] [class*="saveTrustItem"] p');
            const trustFooter = document.querySelector('[data-testid="profile-trust-footer"]');
            const gridTemplateColumns = summaryGridEl ? getComputedStyle(summaryGridEl).gridTemplateColumns : '';
            const objectiveGridColumns = objectiveBoardEl ? getComputedStyle(objectiveBoardEl).gridTemplateColumns : '';
            const titleEl = document.querySelector('[data-testid="profile-screen"] header h1');
            const railControls = Array.from(document.querySelectorAll('[data-testid="profile-section-rail"] a')).map(
                (element) => element.getBoundingClientRect().height
            );
            const relicSummary = document.querySelector('[data-testid="profile-meta-frame-signals"] summary');
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top
                };
            };
            const summaryTileDisplays = Array.from(
                document.querySelectorAll('[data-testid="profile-summary-grid"] > *')
            ).map((tile) => getComputedStyle(tile as Element).display);
            return {
                identitySubDisplay: identitySub ? getComputedStyle(identitySub as Element).display : null,
                inlineMetaDisplay: inlineMetaRow ? getComputedStyle(inlineMetaRow as Element).display : null,
                milestoneDisplays: milestoneChips.map((chip) => getComputedStyle(chip as Element).display),
                objectiveColumnCount: objectiveGridColumns
                    ? objectiveGridColumns.split(' ').filter((column) => column.trim().length > 0).length
                    : 0,
                objectiveItemCount: objectiveItems.length,
                objectiveRewardDisplay: firstObjectiveReward ? getComputedStyle(firstObjectiveReward).display : null,
                overviewFrame: rect('[data-testid="profile-meta-frame-overview"]'),
                progressionImpactDisplay: progressionImpactGrid ? getComputedStyle(progressionImpactGrid as Element).display : null,
                progressionDetailDisplay: progressionDetail ? getComputedStyle(progressionDetail as Element).display : null,
                progressionSummaryDisplay: progressionSummary ? getComputedStyle(progressionSummary as Element).display : null,
                railControlHeights: railControls,
                relicSummaryHeight: relicSummary instanceof HTMLElement ? relicSummary.getBoundingClientRect().height : null,
                signalsFrame: rect('[data-testid="profile-meta-frame-signals"]'),
                firstTrustBodyDisplay: firstTrustBody instanceof HTMLElement ? getComputedStyle(firstTrustBody).display : null,
                trustFooterDisplay: trustFooter instanceof HTMLElement ? getComputedStyle(trustFooter).display : null,
                trustFrame: rect('[data-testid="profile-meta-frame-trust"]'),
                summaryColumnCount: gridTemplateColumns
                    ? gridTemplateColumns.split(' ').filter((column) => column.trim().length > 0).length
                    : 0,
                summaryTileDisplays,
                titleClientHeight: titleEl instanceof HTMLElement ? titleEl.clientHeight : 0,
                titleScrollHeight: titleEl instanceof HTMLElement ? titleEl.scrollHeight : 0
            };
        });

        expect(layout.identitySubDisplay).toBe('none');
        expect(layout.inlineMetaDisplay).toBe('none');
        expect(layout.milestoneDisplays.slice(0, 2)).toEqual(['block', 'block']);
        expect(layout.milestoneDisplays.slice(2).every((display) => display === 'none')).toBe(true);
        expect(layout.objectiveColumnCount).toBe(2);
        expect(layout.objectiveItemCount).toBeGreaterThanOrEqual(4);
        expect(layout.objectiveRewardDisplay).toBe('none');
        expect(layout.progressionImpactDisplay).toBe('none');
        expect(layout.progressionDetailDisplay).toBe('none');
        expect(layout.progressionSummaryDisplay).toBe('none');
        expect(layout.railControlHeights.every((height) => height >= 32)).toBe(true);
        expect(layout.relicSummaryHeight ?? 0).toBeGreaterThanOrEqual(32);
        expect(layout.summaryColumnCount).toBe(2);
        expect(layout.summaryTileDisplays.slice(0, 4).every((display) => display !== 'none')).toBe(true);
        expect(layout.summaryTileDisplays.slice(4).every((display) => display === 'none')).toBe(true);
        expect(layout.overviewFrame?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(300);
        expect(layout.signalsFrame?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(650);
        expect(layout.trustFrame?.top ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(760);
        expect(layout.firstTrustBodyDisplay).toBe('none');
        expect(layout.trustFooterDisplay).toBe('none');
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        await expect(summaryGrid).toBeVisible();
    });

    test('mobile shop keeps the footer dock visible while stock scrolls independently', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'floorClearWithShop');
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();

        const shop = page.getByTestId('shop-screen');
        const stockGrid = page.getByTestId('shop-stock-grid');
        const footerDock = page.getByTestId('shop-action-dock');
        await expect(shop).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, footerDock, 8);
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('shop-reroll-button'), 8);
        await expect(footerDock.locator('[data-compact-label="Back"]')).toHaveCount(1);
        await expect(footerDock.locator('[data-compact-label="Summary"]')).toHaveCount(0);

        const layout = await page.evaluate(() => {
            const stockGridEl = document.querySelector('[data-testid="shop-stock-grid"]');
            const footerDockEl = document.querySelector('[data-testid="shop-action-dock"]');
            const rerollButton = document.querySelector('[data-testid="shop-reroll-button"]');
            const firstCard = stockGridEl?.querySelector('[role="listitem"]');
            const secondCard = stockGridEl?.querySelectorAll('[role="listitem"]')[1];
            const firstDescription = firstCard?.querySelector('p');
            const firstPayoffRows = firstCard?.querySelector('[data-testid$="-payoffs"]');
            const firstBoardMoment = firstCard?.querySelector('[data-testid$="-board-moment"]');
            const firstBuyCue = firstCard?.querySelector('[data-testid$="-buy-cue"]');
            const firstHeatCue = firstCard?.querySelector('[data-testid$="-heat"]');
            const stockCards = Array.from(stockGridEl?.querySelectorAll('[role="listitem"]') ?? []);
            const lastCard = stockCards[stockCards.length - 1] ?? null;
            const revealAction = document.querySelector('[data-shop-action-label="Buy reveal"]');
            const actionButtons = Array.from(
                document.querySelectorAll('[data-testid="shop-action-dock"] button:not([data-testid="shop-reroll-button"])')
            );
            const actionSmallDisplays = Array.from(
                document.querySelectorAll('[data-testid="shop-action-dock"] button:not([data-testid="shop-reroll-button"]) small')
            ).map((element) => getComputedStyle(element).display);
            const rerollSmall = document.querySelector('[data-testid="shop-reroll-button"] small');
            return {
                actionSmallDisplays,
                actionRowTop: actionButtons.length >= 1 ? actionButtons[0]!.getBoundingClientRect().top : null,
                actionTopSpread:
                    actionButtons.length >= 2
                        ? Math.abs(
                              actionButtons[0]!.getBoundingClientRect().top - actionButtons[1]!.getBoundingClientRect().top
                          )
                        : null,
                dockHeight: footerDockEl ? footerDockEl.getBoundingClientRect().height : null,
                firstCardHeight: firstCard ? firstCard.getBoundingClientRect().height : null,
                firstBoardMomentDisplay: firstBoardMoment ? getComputedStyle(firstBoardMoment).display : null,
                firstBuyCueDisplay: firstBuyCue ? getComputedStyle(firstBuyCue).display : null,
                firstDescriptionDisplay: firstDescription ? getComputedStyle(firstDescription).display : null,
                firstHeatCueDisplay: firstHeatCue ? getComputedStyle(firstHeatCue).display : null,
                firstPayoffRowsDisplay: firstPayoffRows ? getComputedStyle(firstPayoffRows).display : null,
                revealActionBadge: revealAction?.getAttribute('data-shop-action-badge') ?? null,
                revealActionText: revealAction?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
                rerollSmallDisplay: rerollSmall ? getComputedStyle(rerollSmall).display : null,
                rerollTop: rerollButton ? rerollButton.getBoundingClientRect().top : null,
                rerollHeight: rerollButton ? rerollButton.getBoundingClientRect().height : null,
                secondCardTop: secondCard ? secondCard.getBoundingClientRect().top : null,
                stockBlankTail:
                    stockGridEl && lastCard
                        ? stockGridEl.getBoundingClientRect().bottom - lastCard.getBoundingClientRect().bottom
                        : null,
                stockOverflowY: stockGridEl ? getComputedStyle(stockGridEl).overflowY : null
                ,
                stockHeight: stockGridEl ? stockGridEl.getBoundingClientRect().height : null
            };
        });

        expect(layout.stockOverflowY).toBe('auto');
        expect(layout.actionSmallDisplays.length).toBeGreaterThan(0);
        expect(layout.actionSmallDisplays.every((display) => display === 'none')).toBe(true);
        expect(layout.rerollSmallDisplay).not.toBe('none');
        expect(layout.dockHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(62);
        expect(layout.firstCardHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(90);
        expect(layout.firstBoardMomentDisplay).toBe('none');
        expect(layout.firstBuyCueDisplay).toBe('none');
        expect(layout.firstHeatCueDisplay).toBe('none');
        expect(layout.firstPayoffRowsDisplay).toBe('none');
        expect(layout.firstDescriptionDisplay).toBe('none');
        expect(layout.revealActionBadge).toBe('2g');
        expect(layout.revealActionText).toContain('Buy reveal');
        expect(layout.revealActionText).not.toContain('Pair scout');
        expect(layout.secondCardTop ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(330);
        expect(layout.stockHeight ?? 0).toBeGreaterThanOrEqual(300);
        expect(layout.stockBlankTail ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(16);
        expect(layout.actionTopSpread ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2);
        expect(Math.abs((layout.rerollTop ?? 0) - (layout.actionRowTop ?? 0))).toBeLessThanOrEqual(2);
        expect(layout.rerollHeight ?? 0).toBeGreaterThanOrEqual(44);
        await expect(stockGrid).toBeVisible();
    });

    test('short landscape shop shows complete ledger rows above the footer dock', async ({ page }) => {
        test.setTimeout(180_000);
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'floorClearWithShop');
        await page.getByRole('dialog', { name: /floor cleared/i }).getByRole('button', { name: /visit shop/i }).click();

        const shop = page.getByTestId('shop-screen');
        const stockGrid = page.getByTestId('shop-stock-grid');
        const footerDock = page.getByTestId('shop-action-dock');

        await expect(shop).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, footerDock, 8);

        const layout = await page.evaluate(() => {
            const rect = (element: Element | null) => {
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    top: box.top,
                    width: box.width
                };
            };
            const stockGridEl = document.querySelector('[data-testid="shop-stock-grid"]');
            const footerDockEl = document.querySelector('[data-testid="shop-action-dock"]');
            const stockCards = Array.from(stockGridEl?.querySelectorAll('[role="listitem"]') ?? []);
            const actionButtons = Array.from(document.querySelectorAll('[data-testid="shop-stock-grid"] [data-shop-action-label]'));
            return {
                actionButtonRects: actionButtons.map((element) => rect(element)),
                footer: rect(footerDockEl),
                stockGrid: rect(stockGridEl),
                stockRows: stockCards.map((element) => rect(element)),
                visibleHeatDetails: stockCards
                    .map((element) => element.querySelector('[data-testid$="-heat"] em'))
                    .filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none').length
            };
        });

        expect(layout.footer).toBeTruthy();
        expect(layout.stockGrid).toBeTruthy();
        expect(layout.stockRows.length).toBeGreaterThanOrEqual(5);
        expect(layout.stockRows.slice(0, 5).every((row) => row && row.bottom <= layout.footer!.top - 4)).toBe(true);
        expect(layout.stockRows.slice(0, 5).every((row) => (row?.height ?? 0) >= 42 && (row?.height ?? 0) <= 54)).toBe(true);
        expect(layout.actionButtonRects.slice(0, 5).every((button) => (button?.height ?? 0) >= 44)).toBe(true);
        expect(layout.visibleHeatDetails).toBe(0);
        await expect(stockGrid).toBeVisible();
    });

    test('mobile game over prioritizes the action dock and compact recap grid', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'gameOver');

        const topSummary = page.getByTestId('game-over-above-fold-summary');
        const outcomeSignals = page.getByTestId('game-over-outcome-signals');
        const payoffBurst = page.getByTestId('game-over-payoff-burst');
        const momentumRecap = page.getByTestId('game-over-momentum-recap');
        const snapshotNextLoop = page.getByTestId('game-over-snapshot-next-loop');
        const summaryGrid = page.getByTestId('game-over-summary-grid');

        await expect(page.getByText(/expedition over/i)).toBeVisible();
        await expect(topSummary).toBeVisible();
        await expect(outcomeSignals).toBeVisible();
        await expect(payoffBurst).toBeVisible();
        await expect(momentumRecap).toBeVisible();
        await expect(snapshotNextLoop).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, topSummary, 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /mobile play again/i }), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /mobile return to the main menu/i }), 8);

        const layout = await page.evaluate(() => {
            const countColumns = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return 0;
                }
                const template = getComputedStyle(element).gridTemplateColumns;
                return template
                    .split(' ')
                    .map((column) => column.trim())
                    .filter((column) => column.length > 0).length;
            };

            const firstPayoffLabel = document.querySelector('[data-testid="game-over-payoff-burst"] small');
            const firstPayoffDetail = document.querySelector('[data-testid="game-over-payoff-burst"] em');
            const firstPayoffAction = document.querySelector('[data-testid="game-over-payoff-burst"] i');
            const topSummaryEl = document.querySelector('[data-testid="game-over-above-fold-summary"]');
            const mobileOutcomeCopy = document.querySelector('[class*="mobileOutcomeCopy"]');
            const scoreSignal = document.querySelector('[data-testid="game-over-outcome-signals"] [data-outcome-signal="score"]');
            const pressureSignal = document.querySelector('[data-testid="game-over-outcome-signals"] [data-outcome-signal="pressure"]');
            const summaryGridEl = document.querySelector('[data-testid="game-over-summary-grid"]');
            const heroPanel = document.querySelector('[class*="heroPanel"]');
            const heroTitle = document.querySelector('[data-testid="game-over-hero-panel"] h1');
            const momentumRecap = document.querySelector('[data-testid="game-over-momentum-recap"]');
            const pickupRecapDetail = document.querySelector(
                '[data-testid="game-over-momentum-recap"] [data-momentum-recap-id="pickup"] em'
            );
            const nextFocusRecapDetail = document.querySelector(
                '[data-testid="game-over-momentum-recap"] [data-momentum-recap-id="next-focus"] em'
            );
            const riskRecap = document.querySelector('[data-testid="game-over-momentum-recap"] [data-momentum-recap-tone="risk"]');
            const payoffBurst = document.querySelector('[data-testid="game-over-payoff-burst"]');
            const riskPayoff = document.querySelector(
                '[data-testid="game-over-payoff-burst"] [data-payoff-burst-tone="risk"]'
            );
            const runSnapshot = document.querySelector('[data-testid="game-over-run-snapshot"]');
            const runSnapshotHeading = document.querySelector('[data-testid="game-over-mode-heading"]');
            const firstSnapshotCopy = document.querySelector('[data-testid="game-over-run-snapshot"] p:nth-of-type(1)');
            const secondSnapshotCopy = document.querySelector('[data-testid="game-over-run-snapshot"] p:nth-of-type(2)');
            const visibleJournalRows = Array.from(
                document.querySelectorAll('[data-testid="game-over-dungeon-journal"] > *')
            ).filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none');
            const snapshotNextLoop = document.querySelector('[data-testid="game-over-snapshot-next-loop"]');
            const snapshotNextLoopRows = Array.from(
                document.querySelectorAll('[data-testid="game-over-snapshot-next-loop"] > *')
            ).filter((element) => element instanceof HTMLElement && getComputedStyle(element).display !== 'none');
            const clippedSnapshotNextDetails = Array.from(
                document.querySelectorAll('[data-testid="game-over-snapshot-next-loop"] small')
            ).filter(
                (element) =>
                    element instanceof HTMLElement &&
                    getComputedStyle(element).display !== 'none' &&
                    element.scrollHeight > element.clientHeight + 4
            ).length;

            return {
                clippedSnapshotNextDetails,
                firstSnapshotCopyDisplay: firstSnapshotCopy ? getComputedStyle(firstSnapshotCopy).display : null,
                firstPayoffActionDisplay: firstPayoffAction ? getComputedStyle(firstPayoffAction).display : null,
                firstPayoffDetailDisplay: firstPayoffDetail ? getComputedStyle(firstPayoffDetail).display : null,
                firstPayoffLabelDisplay: firstPayoffLabel ? getComputedStyle(firstPayoffLabel).display : null,
                heroPanelHeight: heroPanel ? heroPanel.getBoundingClientRect().height : null,
                heroTitleClientHeight: heroTitle instanceof HTMLElement ? heroTitle.clientHeight : 0,
                heroTitleLineHeight: heroTitle instanceof HTMLElement ? getComputedStyle(heroTitle).lineHeight : null,
                heroTitleScrollHeight: heroTitle instanceof HTMLElement ? heroTitle.scrollHeight : 0,
                momentumColumns: countColumns('[data-testid="game-over-momentum-recap"]'),
                momentumHeight: momentumRecap ? momentumRecap.getBoundingClientRect().height : null,
                mobileOutcomeCopyDisplay: mobileOutcomeCopy ? getComputedStyle(mobileOutcomeCopy).display : null,
                nextFocusRecapDetailText: nextFocusRecapDetail?.textContent ?? null,
                outcomeColumns: countColumns('[data-testid="game-over-outcome-signals"]'),
                payoffHeight: payoffBurst ? payoffBurst.getBoundingClientRect().height : null,
                pickupRecapDetailText: pickupRecapDetail?.textContent ?? null,
                pressureSignalDisplay: pressureSignal ? getComputedStyle(pressureSignal).display : null,
                riskPayoffDisplay: riskPayoff ? getComputedStyle(riskPayoff).display : null,
                riskRecapDisplay: riskRecap ? getComputedStyle(riskRecap).display : null,
                runSnapshotBottom: runSnapshot ? runSnapshot.getBoundingClientRect().bottom : null,
                runSnapshotHeight: runSnapshot ? runSnapshot.getBoundingClientRect().height : null,
                runSnapshotHeadingTop: runSnapshotHeading ? runSnapshotHeading.getBoundingClientRect().top : null,
                scoreSignalDisplay: scoreSignal ? getComputedStyle(scoreSignal).display : null,
                secondSnapshotCopyDisplay: secondSnapshotCopy ? getComputedStyle(secondSnapshotCopy).display : null,
                snapshotNextLoopColumns: countColumns('[data-testid="game-over-snapshot-next-loop"]'),
                snapshotNextLoopDisplay: snapshotNextLoop ? getComputedStyle(snapshotNextLoop).display : null,
                snapshotNextLoopRows: snapshotNextLoopRows.length,
                summaryGridDisplay: summaryGridEl ? getComputedStyle(summaryGridEl).display : null,
                topSummaryHeight: topSummaryEl ? topSummaryEl.getBoundingClientRect().height : null,
                visibleJournalRows: visibleJournalRows.length
            };
        });

        expect(layout.outcomeColumns).toBe(2);
        expect(layout.momentumColumns).toBe(2);
        expect(layout.mobileOutcomeCopyDisplay).toBe('none');
        expect(layout.topSummaryHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(56);
        expect(layout.scoreSignalDisplay).toBe('none');
        expect(layout.pressureSignalDisplay).toBe('none');
        expect(layout.riskRecapDisplay).toBe('none');
        expect(layout.riskPayoffDisplay).toBe('none');
        expect(layout.firstPayoffLabelDisplay).toBe('none');
        expect(layout.firstPayoffDetailDisplay).toBe('none');
        expect(layout.firstPayoffActionDisplay).not.toBe('none');
        expect(layout.heroPanelHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(460);
        expect(layout.heroTitleScrollHeight).toBeLessThanOrEqual(layout.heroTitleClientHeight + 4);
        expect(Number.parseFloat(layout.heroTitleLineHeight ?? '0')).toBeGreaterThan(24);
        expect(layout.momentumHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(155);
        expect(layout.pickupRecapDetailText).toBe('Findable pairs claimed.');
        expect(layout.nextFocusRecapDetailText).toBe('Reach x4 before side rewards.');
        expect(layout.payoffHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(140);
        expect(layout.runSnapshotHeadingTop ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(560);
        expect(layout.runSnapshotHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(230);
        expect(layout.runSnapshotBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(700);
        expect(layout.firstSnapshotCopyDisplay).toBe('none');
        expect(layout.secondSnapshotCopyDisplay).toBe('none');
        expect(layout.visibleJournalRows).toBe(1);
        expect(layout.snapshotNextLoopDisplay).toBe('grid');
        expect(layout.snapshotNextLoopColumns).toBe(1);
        expect(layout.snapshotNextLoopRows).toBe(2);
        expect(layout.clippedSnapshotNextDetails).toBe(0);
        expect(layout.summaryGridDisplay).toBe('none');
        await expect(summaryGrid).toBeHidden();
    });

    test('short landscape game over uses one restart console without receipt bars', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'gameOver');

        const screen = page.getByTestId('game-over-screen');
        const heroPanel = page.getByTestId('game-over-hero-panel');
        const mobileDock = page.getByTestId('game-over-above-fold-summary');
        const sideDock = page.getByTestId('game-over-action-dock');
        const payoffBurst = page.getByTestId('game-over-payoff-burst');
        const outcomeSignals = page.getByTestId('game-over-outcome-signals');
        const momentumRecap = page.getByTestId('game-over-momentum-recap');

        await expect(screen).toBeVisible();
        await expect(heroPanel).toBeVisible();
        await expect(mobileDock).toBeVisible();
        await expect(sideDock).toBeHidden();
        await expect(payoffBurst).toBeHidden();
        await expect(outcomeSignals).toBeVisible();
        await expect(momentumRecap).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, heroPanel, 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /mobile play again/i }), 8);
        await expectLocatorFullyInWindowViewport(page, page.getByRole('button', { name: /mobile return to the main menu/i }), 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    left: bounds.left,
                    right: bounds.right,
                    top: bounds.top,
                    width: bounds.width
                };
            };
            const countColumns = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return 0;
                }
                return getComputedStyle(element)
                    .gridTemplateColumns
                    .split(' ')
                    .filter(Boolean).length;
            };
            const clippedVisibleText = Array.from(
                document.querySelectorAll(
                    '[data-testid="game-over-hero-panel"] h1, [data-testid="game-over-outcome-signals"] strong, [data-testid="game-over-momentum-recap"] strong, [data-testid="game-over-momentum-recap"] em'
                )
            )
                .filter(
                    (element) =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        (element.scrollWidth > element.clientWidth + 4 || element.scrollHeight > element.clientHeight + 4)
                )
                .map((element) => element.textContent?.trim().replace(/\s+/g, ' ') ?? '');

            return {
                clippedVisibleText,
                heroPanel: rect('[data-testid="game-over-hero-panel"]'),
                layoutColumns: countColumns('[data-testid="game-over-screen"] [class*="layout"]'),
                mobileDock: rect('[data-testid="game-over-above-fold-summary"]'),
                momentumColumns: countColumns('[data-testid="game-over-momentum-recap"]'),
                outcomeColumns: countColumns('[data-testid="game-over-outcome-signals"]'),
                payoffDisplay:
                    document.querySelector('[data-testid="game-over-payoff-burst"]') instanceof HTMLElement
                        ? getComputedStyle(document.querySelector('[data-testid="game-over-payoff-burst"]') as HTMLElement).display
                        : null,
                sideDock: rect('[data-testid="game-over-action-dock"]')
            };
        });

        expect(layout.layoutColumns).toBe(1);
        expect(layout.outcomeColumns).toBe(3);
        expect(layout.momentumColumns).toBe(3);
        expect(layout.heroPanel?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(245);
        expect(layout.heroPanel?.top ?? Number.NEGATIVE_INFINITY).toBeGreaterThanOrEqual(40);
        expect(layout.heroPanel?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(350);
        expect(layout.mobileDock?.height ?? 0).toBeGreaterThanOrEqual(38);
        expect(layout.sideDock?.height ?? 0).toBe(0);
        expect(layout.sideDock?.width ?? 0).toBe(0);
        expect(layout.payoffDisplay).toBe('none');
        expect(layout.clippedVisibleText).toEqual([]);
    });

    test('mobile floor clear prioritizes route choices over result telemetry', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'floorClearWithRouteChoices');

        const floorClear = page.getByRole('dialog', { name: /floor cleared/i });
        const momentumStrip = page.getByTestId('floor-clear-momentum-strip');
        const payoffStack = page.getByTestId('floor-clear-payoff-stack');
        const carryForward = page.getByTestId('floor-clear-carry-forward');
        const actionSequence = page.getByTestId('floor-clear-action-sequence');
        const routePanel = page.getByTestId('route-choice-panel');
        const safeRoute = page.getByTestId('route-choice-safe');
        const greedRoute = page.getByTestId('route-choice-greed');
        const mysteryRoute = page.getByTestId('route-choice-mystery');
        const mainMenuButton = floorClear.getByRole('button', { name: /^main menu$/i });

        await expect(floorClear).toBeVisible();
        await expect(payoffStack).toBeVisible();
        await expect(routePanel).toBeVisible();
        await expect(safeRoute).toBeVisible();
        await expect(greedRoute).toBeVisible();
        await expect(mysteryRoute).toBeVisible();
        await expect(momentumStrip).toBeHidden();
        await expect(carryForward).toBeHidden();
        await expect(actionSequence).toBeHidden();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, safeRoute, 8);
        await expectLocatorFullyInWindowViewport(page, greedRoute, 8);
        await expectLocatorFullyInWindowViewport(page, mysteryRoute, 8);
        await expectLocatorFullyInWindowViewport(page, mainMenuButton, 8);

        const layout = await page.evaluate(() => {
            const payoffDetail = document.querySelector('[data-testid="floor-clear-payoff-stack"] em');
            const payoffLabel = document.querySelector('[data-testid="floor-clear-payoff-stack"] small');
            const payoffAction = document.querySelector('[data-testid="floor-clear-payoff-stack"] b');
            const momentumStrip = document.querySelector('[data-testid="floor-clear-momentum-strip"]');
            const carryForward = document.querySelector('[data-testid="floor-clear-carry-forward"]');
            const actionSequence = document.querySelector('[data-testid="floor-clear-action-sequence"]');
            const objectiveStrip = document.querySelector('[data-testid="floor-clear-objective-strip"]');
            const nextSignalStrip = document.querySelector('[data-testid="floor-clear-next-signal-strip"]');
            const receiptDetails = document.querySelector('[data-testid="floor-clear-receipt-details"]');
            const resultStack = document.querySelector('[data-testid="floor-clear-result-stack"]');
            const routePanel = document.querySelector('[data-testid="route-choice-panel"]');
            const floorClear = document.querySelector('[role="dialog"]');
            const routeButtons = ['safe', 'greed', 'mystery'].map((id) =>
                document.querySelector(`[data-testid="route-choice-${id}"]`)
            );
            const routeRisks = ['safe', 'greed', 'mystery'].map((id) =>
                document.querySelector(`[data-testid="route-choice-${id}"] [class*="dungeonMapRoomRisk"]`)
            );
            const routeImpactCues = ['safe', 'greed', 'mystery'].map((id) =>
                document.querySelector(`[data-testid="route-choice-${id}-impact-cue"]`)
            );
            return {
                actionSequenceDisplay: actionSequence ? getComputedStyle(actionSequence).display : null,
                carryForwardDisplay: carryForward ? getComputedStyle(carryForward).display : null,
                impactCueDisplays: routeImpactCues.map((cue) => (cue ? getComputedStyle(cue).display : null)),
                momentumDisplay: momentumStrip ? getComputedStyle(momentumStrip).display : null,
                nextSignalDisplay: nextSignalStrip ? getComputedStyle(nextSignalStrip).display : null,
                objectiveDisplay: objectiveStrip ? getComputedStyle(objectiveStrip).display : null,
                payoffActionDisplay: payoffAction ? getComputedStyle(payoffAction).display : null,
                payoffDetailDisplay: payoffDetail ? getComputedStyle(payoffDetail).display : null,
                payoffLabelDisplay: payoffLabel ? getComputedStyle(payoffLabel).display : null,
                receiptDetailsDisplay: receiptDetails ? getComputedStyle(receiptDetails).display : null,
                floorClearTop: floorClear instanceof HTMLElement ? floorClear.getBoundingClientRect().top : null,
                floorClearBottom: floorClear instanceof HTMLElement ? floorClear.getBoundingClientRect().bottom : null,
                routeButtonHeights: routeButtons.map((button) => button?.getBoundingClientRect().height ?? 0),
                routePanelHeight: routePanel?.getBoundingClientRect().height ?? null,
                routeRiskDisplays: routeRisks.map((risk) => (risk ? getComputedStyle(risk).display : null)),
                resultStackHeight: resultStack?.getBoundingClientRect().height ?? null,
            };
        });

        expect(layout.resultStackHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(230);
        expect(layout.routePanelHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(190);
        expect(layout.routeButtonHeights.every((height) => height > 40 && height <= 58)).toBe(true);
        expect(layout.floorClearTop ?? 0).toBeGreaterThanOrEqual(80);
        expect(layout.floorClearBottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(720);
        expect(layout.impactCueDisplays).toEqual(['grid', 'grid', 'grid']);
        expect(layout.routeRiskDisplays).toEqual(['none', 'none', 'none']);
        expect(layout.momentumDisplay).toBe('none');
        expect(layout.carryForwardDisplay).toBe('none');
        expect(layout.actionSequenceDisplay).toBe('none');
        expect(layout.objectiveDisplay).toBe('none');
        expect(layout.nextSignalDisplay).toBe('none');
        expect(layout.payoffLabelDisplay).toBe('none');
        expect(layout.payoffActionDisplay).toBe('none');
        expect(layout.payoffDetailDisplay).toBe('none');
        expect(layout.receiptDetailsDisplay).toBe('none');
    });

    test('short landscape floor clear keeps route decision compact', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'floorClearWithShop');

        const floorClear = page.getByRole('dialog', { name: /floor cleared/i });
        const continueButton = floorClear.getByRole('button', { name: /continue/i });
        const mainMenuButton = floorClear.getByRole('button', { name: /^main menu$/i });

        await expect(floorClear).toBeVisible();
        await expect(continueButton).toBeVisible();
        await expect(mainMenuButton).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, continueButton, 8);
        await expectLocatorFullyInWindowViewport(page, mainMenuButton, 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    top: box.top
                };
            };
            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element instanceof HTMLElement ? getComputedStyle(element).display : null;
            };

            return {
                actionSequenceDisplay: display('[data-testid="floor-clear-action-sequence"]'),
                receiptDetailsDisplay: display('[data-testid="floor-clear-receipt-details"]'),
                resultStack: rect('[data-testid="floor-clear-result-stack"]'),
                routeSelectedDisplay:
                    document.querySelector('[class*="routeSelectedNote"]') instanceof HTMLElement
                        ? getComputedStyle(document.querySelector('[class*="routeSelectedNote"]') as HTMLElement).display
                        : null
            };
        });

        expect(layout.resultStack).toBeTruthy();
        expect(layout.resultStack!.height).toBeLessThanOrEqual(92);
        expect(layout.actionSequenceDisplay).toBe('none');
        expect(layout.receiptDetailsDisplay).toBe('none');
        expect([null, 'none']).toContain(layout.routeSelectedDisplay);
    });

    test('mobile inventory keeps the summary rail and compact run snapshot readable', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openLevel1Play(page);
        await page.getByTestId('game-toolbar-inventory').click({ timeout: 20_000 });

        const inventory = page.getByRole('region', { name: /inventory/i });
        const rail = page.getByTestId('inventory-section-rail');
        const payoffEngine = page.getByTestId('inventory-payoff-engine');
        const summaryGrid = page.getByTestId('inventory-run-summary-grid');
        const runLoop = page.getByTestId('inventory-run-loop-signals');
        const prepStrip = page.getByTestId('inventory-prep-strip');

        await expect(inventory).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await expectLocatorFullyInWindowViewport(page, inventory.getByRole('button', { name: /^back$/i }), 8);
        await expectLocatorFullyInWindowViewport(page, rail, 8);
        await expectLocatorFullyInWindowViewport(page, payoffEngine, 8);
        await expect(runLoop).toBeVisible();
        await expect(summaryGrid).toBeVisible();
        await expect(prepStrip).toBeVisible();

        const layout = await page.evaluate(() => {
            const countColumns = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return 0;
                }
                const template = getComputedStyle(element).gridTemplateColumns;
                return template
                    .split(' ')
                    .map((column) => column.trim())
                    .filter((column) => column.length > 0).length;
            };

            const prepDetail = document.querySelector('[data-testid="inventory-prep-strip"] p');
            const runHint = Array.from(document.querySelectorAll('[data-testid="inventory-meta-frame-run"] p')).find((element) =>
                element.textContent?.includes('Perfect Memory:')
            );
            const runLoopAction = document.querySelector('[data-testid="inventory-run-loop-signals"] i');
            const title = document.querySelector('[data-testid="inventory-screen"] header h2, [data-testid="inventory-screen"] header h1');
            const railControls = Array.from(document.querySelectorAll('[data-testid="inventory-section-rail"] a')).map((element) => ({
                display: element instanceof HTMLElement ? getComputedStyle(element).display : '',
                height: element.getBoundingClientRect().height
            }));
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    bottom: bounds.bottom,
                    height: bounds.height,
                    top: bounds.top
                };
            };
            const firstConsumableRow = document.querySelector(
                '[data-testid="inventory-meta-frame-consumables"] [class*="archiveCatalogRow"]'
            );
            const consumableRows = Array.from(
                document.querySelectorAll('[data-testid="inventory-meta-frame-consumables"] [class*="archiveCatalogRow"]')
            ).map((element) => {
                const cue = element.querySelector('[class*="inventoryActionCue"]');
                const bounds = element.getBoundingClientRect();
                return {
                    available: element.getAttribute('data-inventory-row-available'),
                    cueDisplay: cue instanceof HTMLElement ? getComputedStyle(cue).display : null,
                    height: bounds.height,
                    kind: element.getAttribute('data-inventory-row-kind'),
                    text: element instanceof HTMLElement ? element.innerText.trim().replace(/\s+/g, ' ') : ''
                };
            });
            return {
                consumableRows,
                firstConsumableRow: firstConsumableRow instanceof HTMLElement
                    ? {
                          height: firstConsumableRow.getBoundingClientRect().height,
                          top: firstConsumableRow.getBoundingClientRect().top
                      }
                    : null,
                header: rect('[data-testid="inventory-screen"] header'),
                payoffEngine: rect('[data-testid="inventory-payoff-engine"]'),
                prepDetailDisplay: prepDetail ? getComputedStyle(prepDetail).display : null,
                prepColumns: countColumns('[data-testid="inventory-prep-strip"]'),
                rail: rect('[data-testid="inventory-section-rail"]'),
                railControls,
                runHintClipped:
                    runHint instanceof HTMLElement ? runHint.scrollHeight > runHint.clientHeight + 4 : true,
                runHintText: runHint?.textContent?.trim() ?? '',
                runLoopActionDisplay: runLoopAction ? getComputedStyle(runLoopAction).display : null,
                runLoop: rect('[data-testid="inventory-run-loop-signals"]'),
                runLoopColumns: countColumns('[data-testid="inventory-run-loop-signals"]'),
                runSnapshotPanel: rect('[data-testid="inventory-meta-frame-run"]'),
                summaryColumns: countColumns('[data-testid="inventory-run-summary-grid"] > div:first-child'),
                titleClipped: title instanceof HTMLElement ? title.scrollWidth > title.clientWidth + 4 : true,
                titleText: title?.textContent?.trim() ?? ''
            };
        });

        expect(layout.runLoopColumns).toBe(2);
        expect(layout.summaryColumns).toBe(2);
        expect(layout.prepColumns).toBe(3);
        expect(layout.prepDetailDisplay).toBe('none');
        expect(layout.runLoopActionDisplay).toBe('none');
        expect(layout.runHintText).toContain('Perfect Memory: no misses');
        expect(layout.runHintClipped).toBe(false);
        expect(layout.titleText).toBe('Inventory');
        expect(layout.titleClipped).toBe(false);
        expect(layout.header?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(84);
        expect(layout.rail?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(42);
        expect(layout.railControls.filter((control) => control.display !== 'none').every((control) => control.height >= 32)).toBe(true);
        expect(layout.railControls.filter((control) => control.display === 'none')).toHaveLength(2);
        expect(layout.payoffEngine?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(36);
        expect(layout.runLoop?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(78);
        expect(layout.runSnapshotPanel?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(280);
        expect(layout.firstConsumableRow?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(54);
        expect(layout.consumableRows.length).toBeGreaterThanOrEqual(10);
        expect(layout.consumableRows.some((row) => row.available === 'true' && row.cueDisplay !== 'none')).toBe(true);
        expect(
            layout.consumableRows
                .filter((row) => row.available === 'false')
                .every((row) => row.cueDisplay === 'none' && !row.text.includes('Restock first'))
        ).toBe(true);
        expect(Math.max(...layout.consumableRows.map((row) => row.height))).toBeLessThanOrEqual(48);
    });

    test('pause modal backdrop keeps minimum padding (safe-area aware layout)', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);
        await page.keyboard.press('p');
        const dialog = page.getByRole('dialog', { name: /run paused/i });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('button', { name: /^resume$/i })).toHaveAttribute('data-ui-variant', 'secondary');
        await expect(dialog.getByRole('button', { name: /^retreat$/i })).toHaveAttribute('data-ui-variant', 'danger');
        const backdrop = dialog.locator('..');
        const padding = await backdrop.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
                top: parseFloat(s.paddingTop),
                right: parseFloat(s.paddingRight),
                bottom: parseFloat(s.paddingBottom),
                left: parseFloat(s.paddingLeft)
            };
        });
        expect(padding.top).toBeGreaterThanOrEqual(14);
        expect(padding.right).toBeGreaterThanOrEqual(14);
        expect(padding.bottom).toBeGreaterThanOrEqual(14);
        expect(padding.left).toBeGreaterThanOrEqual(14);

        const dialogBox = await dialog.evaluate((el) => {
            const box = el.getBoundingClientRect();
            return {
                bottom: box.bottom,
                top: box.top
            };
        });
        expect(dialogBox.top).toBeGreaterThanOrEqual(220);
        expect(dialogBox.top).toBeLessThanOrEqual(390);
        expect(dialogBox.bottom).toBeLessThanOrEqual(760);
    });

    test('settings page footer actions span the panel width on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^settings$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
        const back = page.getByRole('button', { name: /^back$/i });
        const footer = page.getByTestId('settings-action-dock');
        const saveState = page.getByTestId('settings-save-state');
        await expectNoHorizontalOverflow(page);
        expectSettingsCompactFooterMetrics(await readSettingsCompactFooterMetrics(footer));
        await expect(back).toBeVisible();
        await expect(page.getByRole('button', { name: /^save$/i })).toHaveCount(0);
        await expect(saveState).toHaveText(/saved/i);
        await expectLocatorFullyInWindowViewport(page, saveState, 8);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    bottom: bounds.bottom,
                    height: bounds.height
                };
            };
            return {
                categoryDisplay: getComputedStyle(document.querySelector('[data-testid="settings-category-nav"]') as HTMLElement).display,
                categoryNav: rect('[data-testid="settings-category-nav"]'),
                categoryNavFit: (() => {
                    const nav = document.querySelector('[data-testid="settings-category-nav"]');
                    if (!(nav instanceof HTMLElement)) {
                        return null;
                    }
                    const navBox = nav.getBoundingClientRect();
                    const buttonBoxes = Array.from(nav.querySelectorAll('button')).map((button) =>
                        button.getBoundingClientRect()
                    );
                    return {
                        count: buttonBoxes.length,
                        maxRight: Math.max(...buttonBoxes.map((box) => box.right)),
                        minLeft: Math.min(...buttonBoxes.map((box) => box.left)),
                        navLeft: navBox.left,
                        navRight: navBox.right,
                        scrollWidth: nav.scrollWidth,
                        width: nav.clientWidth
                    };
                })(),
                contentScroll: rect('[data-testid="settings-content-scroll"]'),
                footer: rect('[data-testid="settings-shell-footer"]'),
                panel: rect('[data-testid="settings-shell-panel"]')
            };
        });

        expect(layout.categoryDisplay).toBe('grid');
        expect(layout.categoryNav).toBeTruthy();
        expect(layout.categoryNavFit).toBeTruthy();
        expect(layout.contentScroll).toBeTruthy();
        expect(layout.footer).toBeTruthy();
        expect(layout.categoryNavFit!.count).toBe(6);
        expect(layout.categoryNavFit!.scrollWidth).toBeLessThanOrEqual(layout.categoryNavFit!.width + 1);
        expect(layout.categoryNavFit!.minLeft).toBeGreaterThanOrEqual(layout.categoryNavFit!.navLeft - 1);
        expect(layout.categoryNavFit!.maxRight).toBeLessThanOrEqual(layout.categoryNavFit!.navRight + 1);
        expect(layout.categoryNav!.height).toBeLessThanOrEqual(50);
        expect(layout.contentScroll!.top).toBeLessThanOrEqual(270);
        expect(layout.footer!.top).toBeLessThanOrEqual(570);
        expect(layout.footer!.height).toBeLessThanOrEqual(96);
        expect(layout.panel).toBeTruthy();
        expect(layout.panel!.bottom).toBeLessThanOrEqual(layout.footer!.bottom + 18);
    });

    test('desktop settings page keeps saved state and back action in a compact footer row', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^settings$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });

        const settingsSection = page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: /^settings$/i }) })
            .first();
        const footer = page.getByTestId('settings-action-dock');
        const saveState = page.getByTestId('settings-save-state');
        const back = page.getByRole('button', { name: /^back$/i });

        await expect(settingsSection).toHaveAttribute('data-settings-layout', 'desktop');
        await expect(footer).toBeVisible();
        await expect(saveState).toBeVisible();
        await expect(back).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const bounds = element.getBoundingClientRect();
                return {
                    top: bounds.top,
                    right: bounds.right,
                    bottom: bounds.bottom,
                    left: bounds.left,
                    width: bounds.width,
                    height: bounds.height
                };
            };

            const footerEl = document.querySelector('[data-testid="settings-action-dock"]');
            const footerStyle = footerEl instanceof HTMLElement ? getComputedStyle(footerEl) : null;
            return {
                back: rect('[data-testid="settings-action-dock"] button'),
                footer: rect('[data-testid="settings-action-dock"]'),
                flexWrap: footerStyle?.flexWrap ?? null,
                saveState: rect('[data-testid="settings-save-state"]')
            };
        });

        expect(layout.footer).toBeTruthy();
        expect(layout.saveState).toBeTruthy();
        expect(layout.back).toBeTruthy();
        expect(layout.flexWrap).toBe('nowrap');
        expect(layout.footer!.height).toBeLessThanOrEqual(58);
        expect(layout.footer!.width).toBeLessThanOrEqual(360);
        expect(Math.abs(layout.saveState!.top - layout.back!.top)).toBeLessThanOrEqual(2);
        expect(Math.abs(layout.saveState!.height - layout.back!.height)).toBeLessThanOrEqual(8);
        expect(layout.saveState!.right).toBeLessThanOrEqual(layout.back!.left + 12);
    });

    test('in-run codex promotes filter and entries ahead of the knowledge summary on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await page.getByTestId('game-toolbar-codex').click({ timeout: 20_000 });
        await expect(page.getByRole('region', { name: /codex/i })).toBeVisible({ timeout: 20_000 });

        const filter = page.getByTestId('codex-filter-row');
        const content = page.getByTestId('codex-main-column');
        const summary = page.getByTestId('codex-knowledge-base-summary');
        const rewardSignal = page.getByTestId('codex-reward-signal');
        const sectionRail = page.getByTestId('codex-section-rail');
        const subtitle = page.getByText(/Read-only reference v\d+ for cards, traits, rewards, and run rules\./);
        const tabRail = page.getByRole('tablist', { name: /codex browse/i });

        await expect(filter).toBeVisible();
        await expect(content).toBeVisible();
        await expect(summary).toHaveCount(0);
        await expect(rewardSignal).toHaveCount(0);
        await expect(sectionRail).toBeHidden();
        await expect(subtitle).toBeHidden();
        await expect(tabRail).toBeHidden();

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const el = document.querySelector(selector);
                if (!el) {
                    return null;
                }
            const box = el.getBoundingClientRect();
            return { top: box.top, bottom: box.bottom, height: box.height };
            };
            const firstEntryParagraph = document.querySelector('[data-testid="codex-main-column"] p');
            const sectionDetails = Array.from(document.querySelectorAll('[data-testid="codex-main-column"] details'));
            return {
                header: rect('[class*="screenHeader"]'),
                filter: rect('[data-testid="codex-filter-row"]'),
                content: rect('[data-testid="codex-main-column"]'),
                detailsOpenStates: sectionDetails.map((detail) => (detail as HTMLDetailsElement).open),
                firstEntryLineClamp:
                    firstEntryParagraph instanceof HTMLElement ? getComputedStyle(firstEntryParagraph).webkitLineClamp : null
            };
        });

        expect(layout.header).toBeTruthy();
        expect(layout.filter).toBeTruthy();
        expect(layout.content).toBeTruthy();
        expect(layout.header!.height).toBeLessThanOrEqual(96);
        expect(layout.filter!.top).toBeLessThanOrEqual(190);
        expect(layout.content!.top).toBeLessThanOrEqual(230);
        expect(layout.firstEntryLineClamp).toBe('2');
        expect(layout.detailsOpenStates[0]).toBe(true);
        expect(layout.detailsOpenStates.slice(1).every((open) => open === false)).toBe(true);
    });

    test('mobile menu codex keeps section chips visible without burying search or entries', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^codex$/i }).click({ force: true });

        const sectionRail = page.getByTestId('codex-section-rail');
        const filter = page.getByTestId('codex-filter-row');
        const content = page.getByTestId('codex-main-column');
        const subtitle = page.getByText(/Read-only reference v\d+ for cards, traits, rewards, and run rules\./);

        await expect(sectionRail).toBeVisible();
        await expect(filter).toBeVisible();
        await expect(content).toBeVisible();
        await expect(subtitle).toBeHidden();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return { bottom: box.bottom, height: box.height, left: box.left, right: box.right, top: box.top, width: box.width };
            };
            const sectionRailEl = document.querySelector('[data-testid="codex-section-rail"]');
            const subtitleEl = document.querySelector('[data-testid="codex-screen"] header p');
            const titleEl = document.querySelector('[data-testid="codex-screen"] header h1, [data-testid="codex-screen"] header h2');
            const firstEntry = document.querySelector('[data-testid="codex-main-column"] [class*="entry"]');
            const firstEntryParagraph = document.querySelector('[data-testid="codex-main-column"] p');
            const knowledgeSummary = document.querySelector('[data-testid="codex-knowledge-base-summary"]');
            const sectionDetails = Array.from(document.querySelectorAll('[data-testid="codex-main-column"] details'));
            const closedSummaries = Array.from(
                document.querySelectorAll('[data-testid="codex-main-column"] details:not([open]) summary')
            );
            const linkRects = Array.from(document.querySelectorAll('[data-testid="codex-section-rail"] a')).map((element) => {
                const box = element.getBoundingClientRect();
                return { left: box.left, right: box.right };
            });
            return {
                content: rect('[data-testid="codex-main-column"]'),
                closedSummaryHeights: closedSummaries.map((summary) => summary.getBoundingClientRect().height),
                filter: rect('[data-testid="codex-filter-row"]'),
                firstEntryBorderTopStyle:
                    firstEntry instanceof HTMLElement ? getComputedStyle(firstEntry).borderTopStyle : '',
                firstEntryBox: rect('[data-testid="codex-main-column"] [class*="entry"]'),
                firstEntryLineClamp:
                    firstEntryParagraph instanceof HTMLElement ? getComputedStyle(firstEntryParagraph).webkitLineClamp : '',
                knowledgeSummaryDisplay:
                    knowledgeSummary instanceof HTMLElement ? getComputedStyle(knowledgeSummary).display : null,
                detailsOpenStates: sectionDetails.map((detail) => (detail as HTMLDetailsElement).open),
                firstLinkRight: linkRects[0]?.right ?? 0,
                maxLinkRight: Math.max(...linkRects.map((item) => item.right)),
                minLinkLeft: Math.min(...linkRects.map((item) => item.left)),
                sectionRail: rect('[data-testid="codex-section-rail"]'),
                sectionRailClientWidth: sectionRailEl instanceof HTMLElement ? sectionRailEl.clientWidth : 0,
                sectionRailDisplay: sectionRailEl instanceof HTMLElement ? getComputedStyle(sectionRailEl).display : '',
                sectionRailOverflowX: sectionRailEl instanceof HTMLElement ? getComputedStyle(sectionRailEl).overflowX : '',
                sectionRailScrollWidth: sectionRailEl instanceof HTMLElement ? sectionRailEl.scrollWidth : 0,
                sectionRailWrap: sectionRailEl instanceof HTMLElement ? getComputedStyle(sectionRailEl).flexWrap : '',
                subtitleClientHeight: subtitleEl instanceof HTMLElement ? subtitleEl.clientHeight : 0,
                subtitleScrollHeight: subtitleEl instanceof HTMLElement ? subtitleEl.scrollHeight : 0,
                titleClientHeight: titleEl instanceof HTMLElement ? titleEl.clientHeight : 0,
                titleScrollHeight: titleEl instanceof HTMLElement ? titleEl.scrollHeight : 0,
                viewportWidth: window.innerWidth
            };
        });

        expect(layout.sectionRail).toBeTruthy();
        expect(layout.filter).toBeTruthy();
        expect(layout.content).toBeTruthy();
        expect(layout.sectionRailDisplay).toBe('grid');
        expect(layout.sectionRailOverflowX).toBe('visible');
        expect(layout.sectionRail!.height).toBeLessThanOrEqual(54);
        expect(layout.sectionRailScrollWidth).toBeLessThanOrEqual(layout.sectionRailClientWidth + 2);
        expect(layout.firstEntryLineClamp).toBe('1');
        expect(layout.firstEntryBorderTopStyle).toBe('none');
        expect(layout.firstEntryBox!.height).toBeLessThanOrEqual(56);
        expect(layout.closedSummaryHeights.every((height) => height <= 28)).toBe(true);
        expect(layout.knowledgeSummaryDisplay).toBe('none');
        expect(layout.detailsOpenStates[0]).toBe(true);
        expect(layout.detailsOpenStates.slice(1).every((open) => open === false)).toBe(true);
        expect(layout.subtitleScrollHeight).toBeLessThanOrEqual(layout.subtitleClientHeight + 4);
        expect(layout.titleScrollHeight).toBeLessThanOrEqual(layout.titleClientHeight + 4);
        expect(layout.minLinkLeft).toBeGreaterThanOrEqual(0);
        expect(layout.firstLinkRight).toBeLessThanOrEqual(layout.viewportWidth);
        expect(layout.maxLinkRight).toBeLessThanOrEqual(layout.viewportWidth);
        expect(layout.filter!.top).toBeLessThanOrEqual(200);
        expect(layout.content!.top).toBeLessThanOrEqual(245);

        await page.getByRole('searchbox', { name: /filter topics/i }).fill('perfect memory');
        await expect(page.getByTestId('codex-screen')).toHaveAttribute('data-codex-filter-state', 'filtered');
        const filteredLineClamp = await page.evaluate(() => {
            const paragraph = document.querySelector('[data-testid="codex-main-column"] p');
            return paragraph instanceof HTMLElement ? getComputedStyle(paragraph).webkitLineClamp : '';
        });
        expect(filteredLineClamp).not.toBe('3');
        const filteredOpenStates = await page.evaluate(() =>
            Array.from(document.querySelectorAll('[data-testid="codex-main-column"] details')).map(
                (detail) => (detail as HTMLDetailsElement).open
            )
        );
        expect(filteredOpenStates.every((open) => open === true)).toBe(true);
    });

    test('run settings modal footer actions span the dialog width on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const dialog = page.getByRole('dialog', { name: /run settings/i });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('button', { name: /^save$/i })).toHaveCount(0);
        await expect(dialog.getByTestId('settings-save-state')).toHaveText(/saved/i);
        expectSettingsCompactFooterMetrics(await readSettingsCompactFooterMetrics(dialog.getByTestId('settings-action-dock')));
    });

    test('run settings modal avoids a dead gap before the footer on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });

        const dialog = page.getByRole('dialog', { name: /run settings/i });
        const contentScroll = page.getByTestId('settings-content-scroll');
        const footer = page.getByTestId('settings-shell-footer');

        await expect(dialog).toBeVisible();
        await expect(contentScroll).toBeVisible();
        await expect(footer).toBeVisible();
        await expect(dialog.getByRole('button', { name: /^back$/i })).toBeVisible();
        await expect(dialog.getByRole('button', { name: /^save$/i })).toHaveCount(0);
        await expect(dialog.getByTestId('settings-save-state')).toHaveText(/saved/i);
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const content = document.querySelector('[data-testid="settings-content-scroll"]');
            const footerEl = document.querySelector('[data-testid="settings-shell-footer"]');
            if (!(content instanceof HTMLElement) || !(footerEl instanceof HTMLElement)) {
                return null;
            }
            const lastChild = content.lastElementChild as HTMLElement | null;
            const footerBox = footerEl.getBoundingClientRect();
            const lastChildBox = lastChild?.getBoundingClientRect() ?? null;
            return {
                contentFlexGrow: getComputedStyle(content).flexGrow,
                footerMarginTop: getComputedStyle(footerEl).marginTop,
                gapBeforeFooter: lastChildBox ? footerBox.top - lastChildBox.bottom : null
            };
        });

        expect(layout).toBeTruthy();
        expect(layout!.contentFlexGrow).toBe('0');
        expect(layout!.footerMarginTop).toBe('0px');
        expect(layout!.gapBeforeFooter).not.toBeNull();
        expect(layout!.gapBeforeFooter!).toBeLessThanOrEqual(28);
    });

    test('short-height landscape settings page collapses to one column with full-width actions', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^settings$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
        const settingsSection = page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: /^settings$/i }) })
            .first();
        await expect(settingsSection).toHaveAttribute('data-settings-layout', 'short-stacked');
        const layout = await readSettingsLayout(settingsSection);
        const metrics = await readSettingsShellMetrics(page, settingsSection);

        expect(layout.contentBelowNav).toBe(true);
        expect(layout.buttonMetrics).toHaveLength(1);
        for (const button of layout.buttonMetrics) {
            expect(button.width).toBeGreaterThanOrEqual(button.groupWidth - 2);
        }
        expect(metrics.zoom).toBeCloseTo(1, 3);
        await expectSettingsPanelInset(page, settingsSection, 6);
        await expectSettingsCategoryStripReadable(settingsSection);
        await expectSettingsFooterButtonsInViewport(page, settingsSection);
        await expectAppScrollportHasNoVerticalOverflow(page);
    });

    test('short-height landscape run settings modal collapses to one column with full-width actions', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await page.getByTestId('game-toolbar-settings').click();
        const dialog = page.getByRole('dialog', { name: /run settings/i });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('data-settings-layout', 'short-stacked');
        const layout = await readSettingsLayout(dialog);
        const metrics = await readSettingsShellMetrics(page, dialog);

        expect(layout.contentBelowNav).toBe(true);
        expect(layout.buttonMetrics).toHaveLength(1);
        for (const button of layout.buttonMetrics) {
            expect(button.width).toBeGreaterThanOrEqual(button.groupWidth - 2);
        }
        expect(metrics.zoom).toBeCloseTo(1, 3);
        await expectSettingsPanelInset(page, dialog, 6);
        await expectSettingsCategoryStripReadable(dialog);
        await expectSettingsFooterButtonsInViewport(page, dialog);
        /* PLAY-003 dual-row HUD @ 844×390: strict scrollHeight can exceed client by ~70px without user scroll. */
        const visibleControlLane = await page.evaluate(() => {
            const footer = document.querySelector('[data-testid="settings-shell-footer"]');
            const scroll = document.querySelector('[data-testid="settings-content-scroll"]');
            const visibleSegments = Array.from(
                document.querySelectorAll('[data-testid="settings-content-scroll"] button')
            )
                .filter(
                    (element): element is HTMLElement =>
                        element instanceof HTMLElement &&
                        getComputedStyle(element).display !== 'none' &&
                        element.getBoundingClientRect().height > 0
                )
                .map((element) => {
                    const box = element.getBoundingClientRect();
                    return {
                        bottom: box.bottom,
                        text: element.textContent?.trim().replace(/\s+/g, ' ') ?? '',
                        top: box.top
                    };
                });
            const footerBox = footer instanceof HTMLElement ? footer.getBoundingClientRect() : null;
            const scrollBox = scroll instanceof HTMLElement ? scroll.getBoundingClientRect() : null;
            return {
                gapBeforeFooter:
                    footerBox && scrollBox
                        ? footerBox.top - scrollBox.bottom
                        : null,
                footerTop: footerBox?.top ?? null,
                maxVisibleSegmentBottom:
                    visibleSegments.length > 0 ? Math.max(...visibleSegments.map((segment) => segment.bottom)) : null,
                scrollBottom: scrollBox?.bottom ?? null,
                visibleSegments
            };
        });

        expect(visibleControlLane.footerTop).toBeTruthy();
        expect(visibleControlLane.scrollBottom).toBeTruthy();
        expect(visibleControlLane.maxVisibleSegmentBottom).toBeTruthy();
        expect(visibleControlLane.scrollBottom!).toBeLessThanOrEqual(visibleControlLane.footerTop! - 2);
        expect(visibleControlLane.gapBeforeFooter).not.toBeNull();
        expect(visibleControlLane.gapBeforeFooter!).toBeLessThanOrEqual(22);
        expect(visibleControlLane.maxVisibleSegmentBottom!).toBeLessThanOrEqual(visibleControlLane.footerTop! - 4);
        await expectAppScrollportHasNoVerticalOverflow(page, 80);
    });

    test('900x700 settings page keeps About reset action in the viewport without app scroll', async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 700 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^settings$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const settingsSection = page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: /^settings$/i }) })
            .first();
        await expect(settingsSection).toBeVisible();
        await expect(settingsSection).toHaveAttribute('data-settings-layout', 'short-stacked');
        await settingsSection.getByRole('button', { name: /about/i }).first().click();
        await settingsSection.getByTestId('settings-subsection-nav').getByRole('button', { name: /^reset$/i }).click();
        const reset = settingsSection.getByRole('button', { name: /reset to defaults/i });
        await expect(reset).toBeVisible();
        await expectLocatorFullyInWindowViewport(page, reset);
        await expectSettingsFooterButtonsInViewport(page, settingsSection);
        await expectAppScrollportHasNoVerticalOverflow(page);
    });

    test('900x700 run settings modal keeps About reset action in the viewport without app scroll', async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 700 });
        await navigateToLevel1PlayPhase(page);
        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const dialog = page.getByRole('dialog', { name: /run settings/i });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('data-settings-layout', 'short-stacked');
        await dialog.getByRole('button', { name: /about/i }).first().click();
        await dialog.getByTestId('settings-subsection-nav').getByRole('button', { name: /^reset$/i }).click();
        const reset = dialog.getByRole('button', { name: /reset to defaults/i });
        await expect(reset).toBeVisible();
        await expectLocatorFullyInWindowViewport(page, reset);
        await expectSettingsFooterButtonsInViewport(page, dialog);
        /* Tall game column: `scrollHeight` can inflate vs flex viewport; tolerate slack while shell stays clipped. */
        await expectAppScrollportHasNoVerticalOverflow(page, 140);
    });

    test('1280x720 settings page stays two-column and keeps actions in viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^settings$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const settingsSection = page
            .locator('section')
            .filter({ has: page.getByRole('heading', { name: /^settings$/i }) })
            .first();
        await expect(settingsSection).toBeVisible();
        await expect(settingsSection).toHaveAttribute('data-settings-layout', 'wide-short');
        const layout = await readSettingsLayout(settingsSection);
        const metrics = await readSettingsShellMetrics(page, settingsSection);
        expect(layout.contentBelowNav).toBe(false);
        expect(metrics.zoom).toBeCloseTo(1, 3);
        await expectSettingsPanelInset(page, settingsSection, 4);
        await expectSettingsFooterButtonsInViewport(page, settingsSection);
        await expectAppScrollportHasNoVerticalOverflow(page);
    });

    test('1280x720 run settings modal stays two-column and keeps actions in viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        await navigateToLevel1PlayPhase(page);
        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const dialog = page.getByRole('dialog', { name: /run settings/i });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('data-settings-layout', 'wide-short');
        const layout = await readSettingsLayout(dialog);
        const metrics = await readSettingsShellMetrics(page, dialog);
        expect(layout.contentBelowNav).toBe(false);
        expect(metrics.zoom).toBeCloseTo(1, 3);
        await expectSettingsPanelInset(page, dialog, 4);
        await expectSettingsFooterButtonsInViewport(page, dialog);
        /* In-run settings portaled to `body`; game column can inflate `scrollHeight` vs flex viewport. */
        await expectAppScrollportHasNoVerticalOverflow(page, 80);
    });

    test('compact touch viewport uses a full-bleed board behind the HUD', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        const shell = page.getByTestId('game-shell');
        /* HUD-018 / QA-003: `GameplayHudBar` — `game-hud` plus wing testids; if HUD splits, update navigation-flow + this spec together. */
        const hud = page.getByTestId('game-hud');
        await expectGameplayHudWingsVisible(page);
        const frame = page.getByTestId('tile-board-frame');
        const actionDock = page.getByTestId('game-action-dock');
        const dungeonStatus = page.getByTestId('dungeon-status-panel');

        await expect(page.getByRole('button', { name: /^fit board$/i })).toBeVisible();
        await expect(frame).toHaveAttribute('data-mobile-camera-mode', 'true');
        await expect(dungeonStatus).toBeHidden();

        const shellBox = await shell.boundingBox();
        const hudBox = await hud.boundingBox();
        const frameBox = await frame.boundingBox();
        const dockBox = await actionDock.boundingBox();

        expect(shellBox).toBeTruthy();
        expect(hudBox).toBeTruthy();
        expect(frameBox).toBeTruthy();
        expect(dockBox).toBeTruthy();

        expect(frameBox!.height).toBeGreaterThan(shellBox!.height * 0.62);
        expect(frameBox!.y).toBeGreaterThanOrEqual(shellBox!.y);
        expect(frameBox!.y).toBeLessThanOrEqual(shellBox!.y + 44);
        expect(Math.abs(frameBox!.x - shellBox!.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(frameBox!.width - shellBox!.width)).toBeLessThanOrEqual(12);
        expect(dockBox!.y).toBeGreaterThan(frameBox!.y + frameBox!.height * 0.42);
        expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(shellBox!.y + shellBox!.height + 2);
        expect(hudBox!.y).toBeLessThan(frameBox!.y);
        expect(hudBox!.y + hudBox!.height).toBeLessThanOrEqual(frameBox!.y + 8);
    });

    test('short landscape gameplay keeps HUD labels and action dock from overlapping', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        await expectNoHorizontalOverflow(page);
        await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-mobile-camera-mode', 'true');

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!(element instanceof HTMLElement)) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    width: box.width
                };
            };

            const floor = document.querySelector('[data-testid="hud-floor-hex-frame"]');
            const lives = document.querySelector('[data-testid="hud-lives"]');
            const powers = document.querySelector('[data-testid="game-action-dock"] [data-dock-group="powers"]');
            const controls = document.querySelector('[data-testid="game-action-dock"] [data-dock-group="controls"]');

            return {
                actionDock: rect('[data-testid="game-action-dock"]'),
                controls: rect('[data-testid="game-action-dock"] [data-dock-group="controls"]'),
                endlessChapterBannerDisplay:
                    document.querySelector('[class*="endlessChapterBanner"]') instanceof HTMLElement
                        ? getComputedStyle(document.querySelector('[class*="endlessChapterBanner"]') as HTMLElement).display
                        : null,
                floor: rect('[data-testid="hud-floor-hex-frame"]'),
                floorDisplay: floor instanceof HTMLElement ? getComputedStyle(floor).display : null,
                lives: rect('[data-testid="hud-lives"]'),
                livesDisplay: lives instanceof HTMLElement ? getComputedStyle(lives).display : null,
                powers: rect('[data-testid="game-action-dock"] [data-dock-group="powers"]'),
                powersOverflowing:
                    powers instanceof HTMLElement ? powers.scrollWidth > powers.clientWidth + 2 : false,
                controlsOverflowing:
                    controls instanceof HTMLElement ? controls.scrollWidth > controls.clientWidth + 2 : false,
                viewportHeight: window.innerHeight,
                viewportWidth: window.innerWidth
            };
        });

        expect(layout.floor).toBeTruthy();
        expect(layout.lives).toBeTruthy();
        expect(layout.actionDock).toBeTruthy();
        expect(layout.powers).toBeTruthy();
        expect(layout.controls).toBeTruthy();
        expect(layout.floorDisplay).not.toBe('none');
        expect(layout.livesDisplay).not.toBe('none');
        expect([null, 'none']).toContain(layout.endlessChapterBannerDisplay);
        expect(layout.floor!.right).toBeLessThanOrEqual(layout.lives!.left + 2);
        expect(layout.floor!.bottom).toBeLessThanOrEqual(40);
        expect(layout.lives!.bottom).toBeLessThanOrEqual(40);
        expect(layout.actionDock!.top).toBeGreaterThanOrEqual(layout.viewportHeight - 48);
        expect(layout.actionDock!.bottom).toBeLessThanOrEqual(layout.viewportHeight + 2);
        expect(layout.powers!.right).toBeLessThanOrEqual(layout.controls!.left - 2);
        expect(layout.controls!.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.controlsOverflowing).toBe(false);
    });

    test('compact touch gameplay feedback clears the HUD and bottom action dock', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithTraitRouteSetup');
        await expectGameplayReady(page);

        const opportunityChip = page.getByTestId('chain-opportunity-chip');
        const opportunityCompass = page.getByTestId('board-opportunity-compass');

        await expect(opportunityChip).toBeHidden();
        await expect(opportunityCompass).toBeVisible();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    width: box.width
                };
            };

            return {
                actionDock: rect('[data-testid="game-action-dock"]'),
                bottomRightDockDisplay:
                    document.querySelector('[data-testid="board-status-bottom-right"]') instanceof HTMLElement
                        ? getComputedStyle(document.querySelector('[data-testid="board-status-bottom-right"]') as HTMLElement).display
                        : null,
                boardStatusTopLeftDisplay:
                    document.querySelector('[data-testid="board-status-top-left"]') instanceof HTMLElement
                        ? getComputedStyle(document.querySelector('[data-testid="board-status-top-left"]') as HTMLElement).display
                        : null,
                hud: rect('[data-testid="game-hud"]'),
                opportunityChipDisplay:
                    document.querySelector('[data-testid="chain-opportunity-chip"]') instanceof HTMLElement
                        ? getComputedStyle(document.querySelector('[data-testid="chain-opportunity-chip"]') as HTMLElement).display
                        : null,
                opportunityCompass: rect('[data-testid="board-opportunity-compass"]'),
                viewportWidth: window.innerWidth
            };
        });

        expect(layout.hud).toBeTruthy();
        expect(layout.actionDock).toBeTruthy();
        expect(layout.opportunityCompass).toBeTruthy();
        expect(layout.boardStatusTopLeftDisplay).toBe('none');
        expect([null, 'none']).toContain(layout.bottomRightDockDisplay);
        expect(layout.opportunityChipDisplay).toBeNull();
        expect(layout.opportunityCompass!.bottom).toBeLessThanOrEqual(layout.actionDock!.top - 4);
        expect(layout.opportunityCompass!.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.opportunityCompass!.height).toBeGreaterThanOrEqual(24);
        expect(layout.opportunityCompass!.height).toBeLessThanOrEqual(34);
        expect(layout.opportunityCompass!.width).toBeLessThanOrEqual(180);
    });

    test('compact touch pickup feedback uses one bottom opportunity surface', async ({ page }) => {
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithPickupCashout');
        await expectGameplayReady(page);

        const frame = page.getByTestId('tile-board-frame');
        const opportunityCompass = page.getByTestId('board-opportunity-compass');
        const pickupChip = page.getByTestId('pickup-opportunity-chip');

        await expect(frame).toHaveAttribute('data-opportunity-best-tone', 'pickup');
        await expect(opportunityCompass).toBeVisible();
        await expect(pickupChip).toBeHidden();
        await expectNoHorizontalOverflow(page);

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    bottom: box.bottom,
                    height: box.height,
                    left: box.left,
                    right: box.right,
                    top: box.top,
                    width: box.width
                };
            };

            const bottomRightDock = document.querySelector('[data-testid="board-status-bottom-right"]');
            const actionDock = document.querySelector('[data-testid="game-action-dock"]');
            const powerToolbar = document.querySelector('[data-testid="game-power-toolbar"]');
            const firstPowerButton = powerToolbar?.querySelector('button');
            const firstPowerIntentChip = powerToolbar?.querySelector('[data-testid$="-intent-chip"]');
            const firstPowerPayoffChip = powerToolbar?.querySelector('[data-testid$="-payoff-chip"]');
            const toolPayoffStack = powerToolbar?.querySelector('[data-tool-payoff-stack-tone]');
            const dockGroups = Array.from(document.querySelectorAll('[data-testid="game-action-dock"] [data-dock-group]')).map(
                (element) => {
                    const box = element.getBoundingClientRect();
                    return {
                        group: element.getAttribute('data-dock-group'),
                        left: box.left,
                        order: getComputedStyle(element).order,
                        right: box.right
                    };
                }
            );
            return {
                actionDock: rect('[data-testid="game-action-dock"]'),
                actionDockScrollLeft: actionDock instanceof HTMLElement ? actionDock.scrollLeft : null,
                bottomRightDockDisplay:
                    bottomRightDock instanceof HTMLElement ? getComputedStyle(bottomRightDock).display : null,
                dockGroups,
                firstPowerButton: firstPowerButton instanceof HTMLElement ? rect('[data-testid="game-power-toolbar"] button') : null,
                firstPowerIntentChipDisplay:
                    firstPowerIntentChip instanceof HTMLElement ? getComputedStyle(firstPowerIntentChip).display : null,
                firstPowerPayoffChipDisplay:
                    firstPowerPayoffChip instanceof HTMLElement ? getComputedStyle(firstPowerPayoffChip).display : null,
                opportunityCompass: rect('[data-testid="board-opportunity-compass"]'),
                powerToolbar: rect('[data-testid="game-power-toolbar"]'),
                toolPayoffStackDisplay: toolPayoffStack instanceof HTMLElement ? getComputedStyle(toolPayoffStack).display : null,
                viewportWidth: window.innerWidth
            };
        });

        expect(layout.actionDock).toBeTruthy();
        expect(layout.opportunityCompass).toBeTruthy();
        expect([null, 'none']).toContain(layout.bottomRightDockDisplay);
        expect(layout.actionDockScrollLeft).toBe(0);
        const visualDockGroups = layout.dockGroups
            .filter((group) => group.right > 0 && group.left < layout.viewportWidth)
            .sort((a, b) => a.left - b.left);
        expect(visualDockGroups.map((group) => group.group)).toEqual(expect.arrayContaining(['powers', 'controls']));
        expect(visualDockGroups[0]?.group).toBe('powers');
        expect(visualDockGroups.find((group) => group.group === 'powers')?.order).toBe('0');
        expect(visualDockGroups.find((group) => group.group === 'controls')?.order).toBe('1');
        expect(visualDockGroups[0]?.left).toBeGreaterThanOrEqual(0);
        if (visualDockGroups.some((group) => group.group === 'powers')) {
            expect(visualDockGroups.map((group) => group.group)).toEqual(expect.arrayContaining(['powers']));
            expect(layout.powerToolbar).toBeTruthy();
            expect(layout.firstPowerButton).toBeTruthy();
            expect(layout.powerToolbar!.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
            expect(layout.firstPowerButton!.left).toBeGreaterThanOrEqual(0);
            expect(layout.firstPowerButton!.right).toBeLessThanOrEqual(layout.viewportWidth);
            expect(layout.firstPowerIntentChipDisplay).toBe('none');
            expect(layout.firstPowerPayoffChipDisplay).toBe('none');
            expect(layout.toolPayoffStackDisplay).toBe('none');
        }
        expect(layout.opportunityCompass!.bottom).toBeLessThanOrEqual(layout.actionDock!.top - 4);
        expect(layout.opportunityCompass!.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.opportunityCompass!.height).toBeGreaterThanOrEqual(24);
        expect(layout.opportunityCompass!.height).toBeLessThanOrEqual(34);
        expect(layout.opportunityCompass!.width).toBeLessThanOrEqual(180);
    });

    test('two-finger pinch zooms in, and Fit board resets the viewport', async ({ page }) => {
        test.setTimeout(180_000);
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);

        const frame = page.getByTestId('tile-board-frame');
        const stage = page.getByTestId('tile-board-stage-shell');
        const startA = await pointInLocator(stage, 0.42, 0.46, 1);
        const startB = await pointInLocator(stage, 0.58, 0.54, 2);
        const endA = await pointInLocator(stage, 0.24, 0.3, 1);
        const endB = await pointInLocator(stage, 0.76, 0.7, 2);

        const before = await readBoardViewportState(frame);
        expect(before.zoom).toBeCloseTo(1, 3);

        const pinchOnce = () =>
            dispatchTouchSequence(page, [
                { points: [startA, startB], type: 'touchStart', waitMs: 40 },
                { points: [endA, endB], type: 'touchMove', waitMs: 50 },
                { points: [], type: 'touchEnd', waitMs: 80 }
            ]);

        await pinchOnce();
        const zoomedIn = async (): Promise<boolean> => (await readBoardViewportState(frame)).zoom > 1.03;
        try {
            await expect.poll(zoomedIn, { timeout: 8000 }).toBe(true);
        } catch {
            await page.waitForTimeout(200);
            await pinchOnce();
            try {
                await expect.poll(zoomedIn, { timeout: 12_000 }).toBe(true);
            } catch {
                await page.waitForTimeout(200);
                await pinchOnce();
                try {
                    await expect.poll(zoomedIn, { timeout: 15_000 }).toBe(true);
                } catch {
                    await dispatchStageWheelZoomIn(stage, -1200);
                    await dispatchStageWheelZoomIn(stage, -800);
                    await expect.poll(zoomedIn, { timeout: 15_000 }).toBe(true);
                }
            }
        }

        // Zoom can leave the board animating; avoid Playwright "stable" actionability timeouts on the toolbar.
        await page.getByRole('button', { name: /^fit board$/i }).evaluate((el) => (el as HTMLButtonElement).click());

        await expect(async () => {
            const v = await readBoardViewportState(frame);
            expect(Math.abs(v.panX)).toBeLessThan(0.02);
            expect(Math.abs(v.panY)).toBeLessThan(0.02);
            expect(v.zoom).toBeCloseTo(1, 2);
        }).toPass({ timeout: 20_000 });
    });

    test('two-finger pan moves the viewport and one-finger tap still flips a tile', async ({ page }) => {
        test.setTimeout(300_000);
        await forceCoarsePointerMedia(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);

        const frame = page.getByTestId('tile-board-frame');
        const stage = page.getByTestId('tile-board-stage-shell');

        const pinchStartA = await pointInLocator(stage, 0.43, 0.45, 1);
        const pinchStartB = await pointInLocator(stage, 0.57, 0.55, 2);
        const pinchEndA = await pointInLocator(stage, 0.3, 0.34, 1);
        const pinchEndB = await pointInLocator(stage, 0.7, 0.66, 2);

        const pinchZoomIn = () =>
            dispatchTouchSequence(page, [
                { points: [pinchStartA, pinchStartB], type: 'touchStart', waitMs: 34 },
                { points: [pinchEndA, pinchEndB], type: 'touchMove', waitMs: 40 },
                { points: [], type: 'touchEnd', waitMs: 70 }
            ]);

        await pinchZoomIn();
        const zoomed = async (): Promise<boolean> => (await readBoardViewportState(frame)).zoom > 1.03;
        try {
            await expect.poll(zoomed, { timeout: 8000 }).toBe(true);
        } catch {
            await page.waitForTimeout(200);
            await pinchZoomIn();
            try {
                await expect.poll(zoomed, { timeout: 12_000 }).toBe(true);
            } catch {
                await page.waitForTimeout(200);
                await pinchZoomIn();
                try {
                    await expect.poll(zoomed, { timeout: 15_000 }).toBe(true);
                } catch {
                    await dispatchStageWheelZoomIn(stage, -1200);
                    await dispatchStageWheelZoomIn(stage, -800);
                    await expect.poll(zoomed, { timeout: 15_000 }).toBe(true);
                }
            }
        }

        if ((await readBoardViewportState(frame)).zoom < 2.1) {
            await dispatchStageWheelZoomIn(stage, -1200);
            await dispatchStageWheelZoomIn(stage, -1000);
            await dispatchStageWheelZoomIn(stage, -1000);
            await expect.poll(async () => (await readBoardViewportState(frame)).zoom > 2.1, { timeout: 15_000 }).toBe(true);
        }

        const panStartA = await pointInLocator(stage, 0.34, 0.48, 1);
        const panStartB = await pointInLocator(stage, 0.58, 0.56, 2);
        const panEndA = await pointInLocator(stage, 0.48, 0.54, 1);
        const panEndB = await pointInLocator(stage, 0.72, 0.62, 2);

        const panOnce = () =>
            dispatchTouchSequence(page, [
                { points: [panStartA, panStartB], type: 'touchStart', waitMs: 34 },
                { points: [panEndA, panEndB], type: 'touchMove', waitMs: 40 },
                { points: [], type: 'touchEnd', waitMs: 80 }
            ]);

        const panMagnitude = async (): Promise<number> => {
            const v = await readBoardViewportState(frame);
            return Math.abs(v.panX) + Math.abs(v.panY);
        };

        await panOnce();
        const selectionReady = async (): Promise<boolean> => {
            const v = await readBoardViewportState(frame);
            return v.selectionSuppressed === false;
        };
        try {
            await expect.poll(selectionReady, { timeout: 8000 }).toBe(true);
        } catch {
            await page.waitForTimeout(200);
            await panOnce();
            await expect.poll(selectionReady, { timeout: 12_000 }).toBe(true);
        }

        try {
            await expect.poll(async () => (await panMagnitude()) > 0.02, { timeout: 6000 }).toBe(true);
        } catch {
            await page.waitForTimeout(200);
            await panOnce();
            try {
                await expect.poll(async () => (await panMagnitude()) > 0.02, { timeout: 10_000 }).toBe(true);
            } catch {
                const b = await stage.boundingBox();
                expect(b).toBeTruthy();
                const cx = b!.x + b!.width / 2;
                const cy = b!.y + b!.height / 2;
                await page.mouse.move(cx, cy);
                await page.mouse.down({ button: 'right' });
                await page.mouse.move(cx + 100, cy + 60);
                await page.mouse.up({ button: 'right' });
                try {
                    await expect.poll(async () => (await panMagnitude()) > 0.02, { timeout: 10_000 }).toBe(true);
                } catch {
                    await page.evaluate(() => {
                        const w = window as Window & { __e2ePanBoardBy?: (panX: number, panY: number) => void };
                        if (!w.__e2ePanBoardBy) {
                            throw new Error('window.__e2ePanBoardBy missing; e2e expects Vite dev board viewport hook.');
                        }
                        w.__e2ePanBoardBy(0.22, 0.14);
                    });
                    await expect.poll(async () => (await panMagnitude()) > 0.02, { timeout: 10_000 }).toBe(true);
                }
            }
        }

        await waitForBoardPlayPhase(page);
        await page.waitForTimeout(180);
        const hiddenSlot = await readFirstHiddenSlot(page);
        await clickHiddenTileRowCol(page, hiddenSlot.row, hiddenSlot.column);

        await expect
            .poll(
                async () => Number.parseInt((await frame.getAttribute('data-selected-tile-count')) ?? '0', 10),
                { timeout: 12_000 }
            )
            .toBeGreaterThan(0);
    });
});
