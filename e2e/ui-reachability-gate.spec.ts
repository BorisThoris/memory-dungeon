import { expect, test } from '@playwright/test';
import { buildPopulatedProfileSaveJson, buildVisualSaveJson, gotoWithSave, mainMenuPlayButton } from './visualScreenHelpers';
import { openPlayablePathFixture } from './playablePathHelpers';
import { openLevel1Play, waitLevel1PlayReady } from './visualScreenHelpers';
import { findUnreachableControls } from './uiReachability';

/**
 * The fast half of the fit contract: does a click reach the thing it lands on.
 *
 * The full sweep asks this too, on every screen at six sizes — and takes half an hour, so nobody
 * runs it, which is how a browse grid nothing could click shipped on the Steam Deck's own panel.
 * This one reaches its screens from the menu rather than by playing runs, at the two sizes that
 * actually caught something, so it can sit in the routine path and answer in a couple of minutes.
 */

/*
 * The three that found real bugs: the Deck's panel, a phone held sideways, and a phone held
 * upright — where a browse card rendered at 44px inside a shorter frame, so its middle fell
 * outside the clip and the press landed on the wrapper instead.
 */
const VIEWPORTS = [
    { id: 'steamdeck', width: 1280, height: 800 },
    { id: 'landscape', width: 812, height: 375 },
    { id: 'phone', width: 390, height: 844 }
] as const;

const MENU_SCREENS = [
    ['collection', /^collection$/i],
    ['profile', /^profile$/i],
    ['inventory', /^inventory$/i],
    ['codex', /^codex$/i],
    ['settings', /^settings$/i]
] as const;

test.describe('every control a screen shows can be clicked', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of VIEWPORTS) {
        test(`the menu and its screens at ${viewport.id}`, async ({ page }) => {
            test.setTimeout(240_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });

            // Profile is checked against a save with a full run history: it is the version of that
            // screen that can fail, and an empty one only proves the empty state is reachable.
            for (const [label, button] of MENU_SCREENS) {
                const save = label === 'profile' ? buildPopulatedProfileSaveJson(true) : buildVisualSaveJson(true);
                await gotoWithSave(page, save);
                await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
                expect(await findUnreachableControls(page), `main menu @ ${viewport.id}`).toEqual([]);

                await page.getByRole('button', { name: button }).click();
                await page.waitForTimeout(600);
                expect(await findUnreachableControls(page), `${label} @ ${viewport.id}`).toEqual([]);
            }
        });

        test(`choose your path at ${viewport.id}`, async ({ page }) => {
            test.setTimeout(180_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await gotoWithSave(page, buildVisualSaveJson(true));
            await mainMenuPlayButton(page).waitFor({ state: 'visible', timeout: 30_000 });
            await mainMenuPlayButton(page).click();
            await page.waitForTimeout(900);

            // The browse grid is the one that shipped broken: cards under the pager, on the panel
            // the release checklist names by name.
            expect(await findUnreachableControls(page), `choose your path @ ${viewport.id}`).toEqual([]);
        });
    }

    for (const viewport of VIEWPORTS) {
        test(`the board and its chrome at ${viewport.id}`, async ({ page }) => {
            // This one plays a floor to get there, which is the slowest arrival in the gate and the
            // first thing to time out when the machine is busy — a timeout says nothing about
            // whether a control was reachable, so the budget matches the run-driven fit tests.
            test.setTimeout(600_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openLevel1Play(page);
            await waitLevel1PlayReady(page);
            await page.waitForTimeout(1500);

            expect(await findUnreachableControls(page), `board @ ${viewport.id}`).toEqual([]);

            /*
             * The board's floating overlays position against measured chrome. The hook that
             * measures it named two CSS-module classes, the bar and the dock moved to another
             * module, and it published a clearance of zero every frame with nothing to say so —
             * so the trap toast went back to sitting on the score. A clearance of zero, or none
             * at all, means the measurement found no chrome.
             */
            const clearance = await page.evaluate(() => {
                const hud = document.querySelector('[data-testid="game-hud"]');
                const dock = document.querySelector('[data-testid="game-action-dock"]');
                const carrier = document.querySelector('[style*="--gameplay-hud-top-clearance"]');
                const read = (name: string): number =>
                    carrier ? Number.parseFloat(getComputedStyle(carrier).getPropertyValue(name)) || 0 : 0;
                return {
                    publishedTop: read('--gameplay-hud-top-clearance'),
                    publishedBottom: read('--gameplay-dock-bottom-clearance'),
                    hudBottom: hud ? Math.round(hud.getBoundingClientRect().bottom) : 0,
                    dockHeight: dock ? Math.round(dock.getBoundingClientRect().height) : 0
                };
            });

            expect(clearance.hudBottom, `the HUD bar is on screen @ ${viewport.id}`).toBeGreaterThan(0);
            expect(clearance.publishedTop, `HUD clearance measured @ ${viewport.id}`).toBeGreaterThan(0);
            // Within a pixel of the chrome it is supposed to describe, not merely non-zero.
            expect(Math.abs(clearance.publishedTop - clearance.hudBottom)).toBeLessThanOrEqual(1);
            expect(Math.abs(clearance.publishedBottom - clearance.dockHeight)).toBeLessThanOrEqual(1);
        });
    }

    test('the board tools answer a press', async ({ page }) => {
        // Same reason the board test carries a long budget: it plays a floor to get there.
        test.setTimeout(600_000);
        await page.setViewportSize({ width: 1280, height: 800 });
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);
        await page.waitForTimeout(1500);

        /*
         * Hit-testing says a press can land on the control. It does not say the control does
         * anything, and those came apart twice this week in opposite directions: a browse card
         * that hit-tested fine and did nothing, and settings buttons that hit-tested as covered
         * and worked. The dock is the game's primary control surface and the only test that
         * pressed one of its tools wrapped its single assertion in `if (line.isVisible())`, so it
         * asserted nothing whenever the line was absent — which is the state it was guarding for.
         */
        const readBoard = () =>
            page.evaluate(() => {
                const dock = document.querySelector('[data-testid="game-action-dock"]');
                const line = document.querySelector('[data-testid="run-shell-line"]');
                return {
                    line: line ? (line.textContent ?? '').trim() : null,
                    tools: Array.from(dock?.querySelectorAll('button') ?? [])
                        .map((button) => ({
                            id: button.getAttribute('data-testid') ?? '',
                            disabled: button.hasAttribute('disabled'),
                            pressed: button.getAttribute('aria-pressed'),
                            text: (button.textContent ?? '').trim()
                        }))
                        .filter((tool) => tool.id.startsWith('tool-'))
                };
            });

        const opening = await readBoard();
        expect(opening.tools.length, 'the dock offers tools to press').toBeGreaterThan(0);

        const answered: string[] = [];
        const silent: string[] = [];
        for (const tool of opening.tools) {
            const before = await readBoard();
            const was = before.tools.find((candidate) => candidate.id === tool.id);
            if (!was || was.disabled) {
                // A tool with nothing to spend is not expected to answer; it is not silent either.
                continue;
            }
            await page.getByTestId(tool.id).click({ force: true });
            await page.waitForTimeout(600);
            const after = await readBoard();
            const now = after.tools.find((candidate) => candidate.id === tool.id);

            /*
             * Three ways a press shows: the tool arms, it spends its charge and leaves the dock or
             * changes its count, or the run line says what happened.
             */
            const armed = now !== undefined && now.pressed !== was.pressed;
            const spent = now === undefined || now.text !== was.text;
            const said = after.line !== before.line;
            (armed || spent || said ? answered : silent).push(tool.id);

            /*
             * Disarm by pressing the same tool again, not with Escape. Escape opens the run menu,
             * and every one of these actions is guarded on the view still being the board — so an
             * Escape between presses quietly made every later tool look dead, which is how this
             * loop first accused three working tools.
             */
            if (armed && now?.pressed === 'true') {
                await page.getByTestId(tool.id).click({ force: true });
                await page.waitForTimeout(300);
            }
        }

        expect(silent, 'every dock tool answers a press').toEqual([]);
        expect(answered.length, 'at least one tool was pressable').toBeGreaterThan(0);
    });

    /*
     * The screens a run actually passes through. The vendor's cards were clipped away entirely on
     * a phone held sideways — there was no way to buy anything — and only the half-hour sweep saw
     * it, because the fast checks all stop at the main menu. The fixtures reach these directly
     * instead of playing a floor to get to each one.
     */
    const RUN_FIXTURES = [
        'floorClearWithRouteChoices',
        'floorClearWithShop',
        'sideRoomChoice',
        'relicDraft',
        'gameOver'
    ] as const;

    for (const viewport of VIEWPORTS) {
        for (const fixture of RUN_FIXTURES) {
            test(`${fixture} at ${viewport.id}`, async ({ page }) => {
                test.setTimeout(180_000);
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                // The dev-only fixture hook can miss a beat right after a navigation.
                try {
                    await openPlayablePathFixture(page, fixture);
                } catch {
                    await page.waitForTimeout(1500);
                    await openPlayablePathFixture(page, fixture);
                }
                await page.waitForTimeout(800);
                expect(await findUnreachableControls(page), `${fixture} @ ${viewport.id}`).toEqual([]);

                /*
                 * The shop fixture lands on the floor-clear dialog, one click short of the vendor
                 * — and the vendor is the screen that shipped with its cards clipped away, so
                 * stopping here would check everything except the thing that broke.
                 */
                if (fixture === 'floorClearWithShop') {
                    await page
                        .getByRole('dialog', { name: /floor cleared/i })
                        .getByRole('button', { name: /visit shop/i })
                        .click({ force: true });
                    await page.getByTestId('shop-screen').waitFor({ state: 'visible', timeout: 20_000 });
                    await page.waitForTimeout(700);
                    expect(await findUnreachableControls(page), `vendor @ ${viewport.id}`).toEqual([]);
                }
            });
        }
    }
});
