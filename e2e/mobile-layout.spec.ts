import { expect, test, type Locator, type Page } from '@playwright/test';
import { dispatchTouchSequence, forceCoarsePointerMedia, type TouchDispatchPoint } from './mobileTouchHelpers';
import {
    clickHiddenTileRowCol,
    navigateToLevel1PlayPhase,
    waitForBoardPlayPhase
} from './tileBoardGameFlow';
import {
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow,
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
    await expectLocatorFullyInWindowViewport(page, container.getByRole('button', { name: /^save$/i }));
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
    await expect(page.getByTestId('hud-wing-left')).toBeVisible();
    await expect(page.getByTestId('hud-wing-center')).toBeVisible();
    await expect(page.getByTestId('hud-wing-right')).toBeVisible();
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
        await page.getByText(/^Open$/).click();
        await expect(page.getByText(/first live board highlights a real pair/i)).toBeVisible();
        await expect(page.getByText(/clean matches bank score and streak/i)).toBeVisible();
        await expect(page.getByText(/runs turn into relic drafts/i)).toBeVisible();
        await expect(page.getByText(/codex is the deeper reference/i)).toBeVisible();
    });

    test('phone landscape keeps condensed onboarding copy readable', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await openMainMenuFromSave(page, false);
        await page.getByText(/^Open$/).click();
        await expect(page.getByText(/first live board highlights a real pair/i)).toBeVisible();
        await expect(page.getByText(/clean matches bank score and streak/i)).toBeVisible();
        await expect(page.getByText(/runs turn into relic drafts/i)).toBeVisible();
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
            await expectLocatorFullyInWindowViewport(page, dialog.getByRole('button', { name: /^save$/i }), 8);
        });

        test(`${viewport.name} portrait relic offer overlay fits without clipped picks`, async ({ page }) => {
            await forceCoarsePointerMedia(page);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'relicDraft');

            const relicDialog = page.getByTestId('game-relic-offer-overlay');
            await expect(relicDialog).toBeVisible({ timeout: 30_000 });
            await expectNoHorizontalOverflow(page);
            await expectLocatorFullyInWindowViewport(page, relicDialog, 8);
            await expect(page.getByTestId('relic-offer-card').first()).toBeVisible();
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('relic-offer-card').first(), 8);
        });
    }

    test('pause modal backdrop keeps minimum padding (safe-area aware layout)', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);
        await page.keyboard.press('p');
        await expect(page.getByRole('dialog', { name: /run paused/i })).toBeVisible();
        const backdrop = page.getByRole('dialog', { name: /run paused/i }).locator('..');
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
    });

    test('settings page footer actions span the panel width on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await openMainMenuFromSave(page, true);
        await page.getByRole('button', { name: /^settings$/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible();
        const back = page.getByRole('button', { name: /^back$/i });
        const save = page.getByRole('button', { name: /^save$/i });
        const footer = page.getByTestId('settings-action-dock');
        const sizes = await footer.evaluate((el) => {
            const buttons = Array.from(el.querySelectorAll('button'));
            return {
                container: el.getBoundingClientRect().width,
                buttons: buttons.map((button) => ({
                    width: button.getBoundingClientRect().width,
                    groupWidth: button.parentElement?.getBoundingClientRect().width ?? 0
                }))
            };
        });
        expect(sizes.buttons).toHaveLength(2);
        expect(sizes.buttons[0].groupWidth).toBeGreaterThan(0);
        expect(sizes.buttons[1].groupWidth).toBeGreaterThan(0);
        expect(sizes.buttons[0].width).toBeGreaterThanOrEqual(sizes.buttons[0].groupWidth - 2);
        expect(sizes.buttons[1].width).toBeGreaterThanOrEqual(sizes.buttons[1].groupWidth - 2);
        await expect(back).toBeVisible();
        await expect(save).toBeVisible();
    });

    test('run settings modal footer actions span the dialog width on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await navigateToLevel1PlayPhase(page);
        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const dialog = page.getByRole('dialog', { name: /run settings/i });
        await expect(dialog).toBeVisible();
        const save = dialog.getByRole('button', { name: /^save$/i });
        await expect(save).toBeVisible();
        const footer = dialog.locator('footer');
        const sizes = await footer.evaluate((el) => {
            const buttons = Array.from(el.querySelectorAll('button'));
            return {
                container: el.getBoundingClientRect().width,
                buttons: buttons.map((button) => ({
                    width: button.getBoundingClientRect().width,
                    groupWidth: button.parentElement?.getBoundingClientRect().width ?? 0
                }))
            };
        });
        expect(sizes.buttons).toHaveLength(2);
        expect(sizes.buttons[0].groupWidth).toBeGreaterThan(0);
        expect(sizes.buttons[1].groupWidth).toBeGreaterThan(0);
        expect(sizes.buttons[0].width).toBeGreaterThanOrEqual(sizes.buttons[0].groupWidth - 2);
        expect(sizes.buttons[1].width).toBeGreaterThanOrEqual(sizes.buttons[1].groupWidth - 2);
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
        expect(layout.buttonMetrics).toHaveLength(2);
        expect(layout.buttonMetrics[0].width).toBeGreaterThanOrEqual(layout.buttonMetrics[0].groupWidth - 2);
        expect(layout.buttonMetrics[1].width).toBeGreaterThanOrEqual(layout.buttonMetrics[1].groupWidth - 2);
        expect(metrics.zoom).toBeCloseTo(1, 3);
        await expectSettingsPanelInset(page, settingsSection, 6);
        await expectSettingsCategoryStripReadable(settingsSection);
        await expectSettingsFooterButtonsInViewport(page, settingsSection);
        await expectAppScrollportHasNoVerticalOverflow(page);
    });

    test('short-height landscape run settings modal collapses to one column with full-width actions', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await navigateToLevel1PlayPhase(page);
        await page.getByRole('button', { name: /run settings \(toolbar\)/i }).evaluate((element) => {
            (element as HTMLButtonElement).click();
        });
        const dialog = page.getByRole('dialog', { name: /run settings/i });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAttribute('data-settings-layout', 'short-stacked');
        const layout = await readSettingsLayout(dialog);
        const metrics = await readSettingsShellMetrics(page, dialog);

        expect(layout.contentBelowNav).toBe(true);
        expect(layout.buttonMetrics).toHaveLength(2);
        expect(layout.buttonMetrics[0].width).toBeGreaterThanOrEqual(layout.buttonMetrics[0].groupWidth - 2);
        expect(layout.buttonMetrics[1].width).toBeGreaterThanOrEqual(layout.buttonMetrics[1].groupWidth - 2);
        expect(metrics.zoom).toBeCloseTo(1, 3);
        await expectSettingsPanelInset(page, dialog, 6);
        await expectSettingsCategoryStripReadable(dialog);
        await expectSettingsFooterButtonsInViewport(page, dialog);
        /* PLAY-003 dual-row HUD @ 844×390: strict scrollHeight can exceed client by ~70px without user scroll. */
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

        await expect(page.getByRole('button', { name: /^fit board$/i })).toBeVisible();
        await expect(frame).toHaveAttribute('data-mobile-camera-mode', 'true');

        const shellBox = await shell.boundingBox();
        const hudBox = await hud.boundingBox();
        const frameBox = await frame.boundingBox();
        const dockBox = await actionDock.boundingBox();

        expect(shellBox).toBeTruthy();
        expect(hudBox).toBeTruthy();
        expect(frameBox).toBeTruthy();
        expect(dockBox).toBeTruthy();

        expect(frameBox!.height).toBeGreaterThan(shellBox!.height * 0.62);
        expect(frameBox!.y).toBeLessThanOrEqual(shellBox!.y + 1);
        expect(Math.abs(frameBox!.x - shellBox!.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(frameBox!.width - shellBox!.width)).toBeLessThanOrEqual(12);
        expect(dockBox!.y).toBeGreaterThan(frameBox!.y + frameBox!.height * 0.42);
        expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(shellBox!.y + shellBox!.height + 2);
        expect(hudBox!.y).toBeLessThan(frameBox!.y + frameBox!.height - 8);
        expect(hudBox!.y + hudBox!.height).toBeGreaterThan(frameBox!.y + 8);
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
