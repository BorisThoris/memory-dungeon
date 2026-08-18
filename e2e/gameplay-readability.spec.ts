import { expect, test, type Locator, type Page } from '@playwright/test';
import {
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow
} from './visualScreenHelpers';
import {
    expectGameplayReady,
    openPlayablePathFixture
} from './playablePathHelpers';
import { flipTileAtGridCellKeyboard, waitForBoardPlayPhase } from './tileBoardGameFlow';

const READABILITY_VIEWPORTS = [
    { name: 'phone narrow', width: 360, height: 740 },
    { name: 'phone standard', width: 390, height: 844 },
    { name: 'phone tall', width: 430, height: 932 },
    { name: 'phone short landscape', width: 844, height: 390 },
    { name: 'tablet portrait', width: 820, height: 1180 },
    { name: 'desktop short', width: 1280, height: 720 },
    { name: 'desktop standard', width: 1440, height: 900 }
] as const;

test.describe('Gameplay readability hardening', () => {
    test.describe.configure({ retries: 0 });

    for (const viewport of READABILITY_VIEWPORTS) {
        test(`${viewport.name} keeps HUD, board, and action dock bounded`, async ({ page }) => {
            test.setTimeout(150_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeRunWithHazards');
            await expectGameplayReady(page);

            await expectNoHorizontalOverflow(page);
            await expectAppScrollportHasNoVerticalOverflow(page, 18);
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-hud'), 8);
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('tile-board-frame'), 8);
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-action-dock'), 8);
            await expectBoardKeepsPriority(page);
        });
    }

    test('dense active HUD drawers and power teaching stay bounded', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        await page.getByText(/^Info$/i).click({ force: true });
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-hud'), 8);

        const powerButton = page.getByTestId('game-action-dock').getByRole('button').first();
        await powerButton.click({ force: true });
        const teachingPanel = page.getByTestId('power-teaching-panel');
        if (await teachingPanel.isVisible().catch(() => false)) {
            await expectLocatorFullyInWindowViewport(page, teachingPanel, 8);
        }

        await expectBoardKeepsPriority(page);
    });

    test('mobile hazard fixture compresses chapter and dungeon status chrome above the board', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        const chapterBanner = page.getByTestId('endless-chapter-banner');
        const dungeonStatus = page.getByTestId('dungeon-status-panel');
        const runStrip = page.getByTestId('dungeon-run-strip');
        const traitCue = page.getByTestId('trait-mode-cue');

        await expect(chapterBanner).toBeVisible();
        await expect(dungeonStatus).toBeVisible();
        await expect(runStrip).toBeVisible();
        await expect(traitCue).toBeVisible();
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
                    top: box.top
                };
            };

            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element ? getComputedStyle(element).display : null;
            };

            const frame = document.querySelector('[data-testid="tile-board-frame"]');
            return {
                banner: rect('[data-testid="endless-chapter-banner"]'),
                frameHasDungeonStatus: frame?.getAttribute('data-has-dungeon-status-panel'),
                hintDisplay: display('[data-testid="endless-chapter-hint"]'),
                objectiveDetailDisplay: display('[data-testid="dungeon-status-objective"] small'),
                panel: rect('[data-testid="dungeon-status-panel"]'),
                runStrip: rect('[data-testid="dungeon-run-strip"]'),
                signalsDisplay: display('[data-testid="endless-chapter-signals"]'),
                traitCue: rect('[data-testid="trait-mode-cue"]')
            };
        });

        expect(layout.frameHasDungeonStatus).toBe('true');
        expect(layout.hintDisplay).toBe('none');
        expect(layout.signalsDisplay).toBe('none');
        expect(layout.objectiveDetailDisplay).toBe('none');
        expect(layout.banner?.height ?? 0).toBeLessThanOrEqual(64);
        expect(layout.panel?.height ?? 0).toBeLessThanOrEqual(96);
        expect(layout.runStrip?.height ?? 0).toBeLessThanOrEqual(42);
        expect(layout.traitCue?.top ?? 0).toBeGreaterThanOrEqual((layout.panel?.bottom ?? 0) + 4);
    });

    test('compact mobile overlay consolidates board cues into one readable dock', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithTraitRouteSetup');
        await expectGameplayReady(page);
        await expect(page.getByTestId('board-opportunity-compass')).toBeVisible();
        await expect(page.getByTestId('chain-opportunity-chip')).toBeHidden();

        const layout = await page.evaluate(() => {
            const readRect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const rect = element.getBoundingClientRect();
                return {
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                };
            };

            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element instanceof HTMLElement ? getComputedStyle(element).display : null;
            };

            return {
                actionDock: readRect('[data-testid="game-action-dock"]'),
                bottomRightDockDisplay: display('[data-testid="board-status-bottom-right"]'),
                chainDisplay: display('[data-testid="chain-opportunity-chip"]'),
                compass: readRect('[data-testid="board-opportunity-compass"]'),
                pickupDisplay: display('[data-testid="pickup-opportunity-chip"]'),
                viewportWidth: window.innerWidth
            };
        });

        expect(layout.compass).toBeTruthy();
        expect(layout.actionDock).toBeTruthy();
        expect(layout.chainDisplay).toBeNull();
        expect([null, 'none']).toContain(layout.pickupDisplay);
        expect([null, 'none']).toContain(layout.bottomRightDockDisplay);
        expect(layout.compass!.bottom).toBeLessThanOrEqual(layout.actionDock!.top - 4);
        expect(layout.compass!.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.compass!.height).toBeGreaterThanOrEqual(24);
        expect(layout.compass!.height).toBeLessThanOrEqual(34);
        expect(layout.compass!.width).toBeLessThanOrEqual(205);
    });

    test('mobile action dock prioritizes gameplay powers before utility chrome', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        const controls = page.getByTestId('game-controls-toolbar');
        const powers = page.getByTestId('game-power-toolbar');
        const shuffle = page.getByTestId('game-power-shuffle');
        const payoff = page.getByTestId('tool-payoff-stack');

        await expect(controls).toBeVisible();
        await expect(powers).toBeVisible();
        await expect(shuffle).toBeVisible();
        await expect(payoff).toBeAttached();
        await expect(payoff).toBeHidden();

        const layout = await page.evaluate(() => {
            const rect = (selector: string) => {
                const element = document.querySelector(selector);
                if (!element) {
                    return null;
                }
                const box = element.getBoundingClientRect();
                return {
                    left: box.left,
                    right: box.right,
                    width: box.width
                };
            };

            const display = (selector: string) => {
                const element = document.querySelector(selector);
                return element instanceof HTMLElement ? getComputedStyle(element).display : null;
            };

            return {
                controls: rect('[data-testid="game-controls-toolbar"]'),
                payoffDisplay: display('[data-testid="tool-payoff-stack"]'),
                powers: rect('[data-testid="game-power-toolbar"]'),
                shuffle: rect('[data-testid="game-power-shuffle"]')
            };
        });

        expect(layout.powers?.left ?? Number.POSITIVE_INFINITY).toBeLessThan(layout.controls?.left ?? Number.NEGATIVE_INFINITY);
        expect(layout.shuffle?.left ?? Number.POSITIVE_INFINITY).toBeLessThan(layout.controls?.left ?? Number.NEGATIVE_INFINITY);
        expect(layout.payoffDisplay).toBe('none');
    });

    test('mobile floor clear keeps payoff stack and route choices readable', async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'floorClearWithRouteChoices');

        await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible();
        await expect(page.getByTestId('floor-clear-payoff-stack')).toBeVisible();
        await expect(page.getByTestId('floor-clear-payoff-stack')).toContainText(/Floor payoff stack/i);
        await expect(page.getByTestId('route-choice-panel')).toBeVisible();
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('floor-clear-payoff-stack'), 8);
        await expectLocatorStartsWithinWindowViewport(page, page.getByTestId('route-choice-panel'), 8);
        await expect(page.getByTestId('route-choice-safe')).toBeVisible();
        await expect(page.getByTestId('route-choice-safe')).toHaveAttribute(
            'data-route-next-action',
            'Stabilize route'
        );
        await expect(page.getByTestId('route-choice-safe-action-cue')).toContainText('Do next');
        await expect(page.getByTestId('route-choice-safe-action-cue')).toContainText('Stabilize route');
        await expect(page.getByTestId('route-choice-safe')).toHaveAttribute('data-route-beat-tier', 'guard');
        await expect(page.getByTestId('route-choice-safe-beat-cue')).toContainText('Guard beat');
        await expect(page.getByTestId('route-choice-greed')).toHaveAttribute('data-route-next-action', 'Cash greed');
        await expect(page.getByTestId('route-choice-greed-action-cue')).toContainText('Cash greed');
        await expect(page.getByTestId('route-choice-greed')).toHaveAttribute('data-route-beat-tier', 'cashout');
        await expect(page.getByTestId('route-choice-greed-beat-cue')).toContainText('Cashout beat');
        await expect(page.getByTestId('route-choice-mystery')).toHaveAttribute(
            'data-route-next-action',
            'Prime mystery'
        );
        await expect(page.getByTestId('route-choice-mystery-action-cue')).toContainText('Prime mystery');
        await expect(page.getByTestId('route-choice-mystery')).toHaveAttribute('data-route-beat-tier', 'prime');
        await expect(page.getByTestId('route-choice-mystery-beat-cue')).toContainText('Prime beat');
        await expectNoHorizontalOverflow(page);
    });

    test('board marker contract and live hazard states are exposed for readability audits', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute(
            'data-card-feedback-marker-contract',
            /hidden selected matched disabled enemy-occupied boss-marked trap-armed trap-resolved relic objective exit lock lever shop trait chain-ready chain-surge chain-reward-hot chain-setup trait-combo trait-combo-surge trait-payoff-stack trait-route-target/
        );
        await expect(frame).toHaveAttribute(
            'data-card-feedback-marker-shape-contract',
            'linked-route combo-surge payoff-bar payoff-stack swap-target-crossbar perk-armed-bar followup-target'
        );

        const states = await readCardFeedbackStates(page);
        for (const expected of ['hidden', 'pickable'] as const) {
            expect(states.get(expected) ?? 0, `${expected} marker count`).toBeGreaterThan(0);
        }
        expect((states.get('hazard') ?? 0) + (states.get('relic') ?? 0) + (states.get('objective') ?? 0)).toBeGreaterThan(0);
    });

    test('standalone pickup rewards read as pickup cashouts on the board', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithPickupCashout');
        await expectGameplayReady(page);
        await waitForBoardPlayPhase(page);

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute('data-pickup-opportunity-count', '1');
        await expect(page.getByTestId('pickup-opportunity-chip')).toContainText('Pickup rewards');
        await expect(page.getByTestId('pickup-opportunity-chip')).toContainText('Claim before exit');
        await expect(page.getByTestId('board-opportunity-pickup')).toHaveAttribute(
            'data-opportunity-impact-cue',
            'Pickup cashout'
        );
        await expect(page.getByTestId('board-opportunity-pickup')).toContainText('Pickup cashout');
        await expect(page.getByTestId('board-opportunity-pickup')).toHaveAccessibleName(/Shard spark pickup/i);
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('board-opportunity-pickup'), 8);
    });

    test('trait-route setup fixture makes the swap action obvious', async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithTraitRouteSetup');
        await expectGameplayReady(page);
        await waitForBoardPlayPhase(page);

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute('data-chain-opportunity-setup-count', '2');
        await expect(frame).toHaveAttribute('data-chain-opportunity-next-action', 'prime-route');
        await expect(frame).toHaveAttribute('data-chain-opportunity-next-action-label', 'Do next: prime route');
        await expect(frame).toHaveAttribute('data-chain-opportunity-next-action-detail', /Swap Sealed with Filler/);
        await expect(frame).toHaveAttribute('data-chain-opportunity-next-action-tone', 'setup');
        await expect(frame).toHaveAttribute('data-chain-opportunity-beat-count', '2');
        await expect(frame).toHaveAttribute('data-chain-opportunity-beat-cue', 'pulse');
        await expect(frame).toHaveAttribute('data-chain-opportunity-beat-tier', 'setup');
        await expect(frame).toHaveAttribute('data-chain-opportunity-beat-label', 'Prime beat');
        await expect(frame).toHaveAttribute('data-card-feedback-beat-tiers', 'setup:2');
        await expect(frame).toHaveAttribute('data-card-feedback-beat-counts', '2:2');
        await expect(frame).toHaveAttribute('data-card-feedback-beat-tier-contract', 'cashout surge follow-up route setup');
        await expect(frame).toHaveAttribute('data-chain-accessibility-tone', 'setup');
        await expect(frame).toHaveAttribute('data-chain-accessibility-ready-count', '0');
        await expect(frame).toHaveAttribute('data-chain-accessibility-setup-count', '2');
        await expect(frame).toHaveAttribute(
            'data-chain-accessibility-primary-line',
            /Swap Sealed with Filler: Sealed \+ Heavy: score surge/
        );
        await expect(frame).toHaveAttribute('data-chain-accessibility-secondary-line', 'none');
        await expect(frame).toHaveAttribute('data-opportunity-best-id', 'chain');
        await expect(frame).toHaveAttribute('data-opportunity-best-action', 'Use swap');
        await expect(frame).toHaveAttribute('data-opportunity-best-label', 'Route prime');
        await expect(frame).toHaveAttribute('data-opportunity-best-value', '2 primed');
        await expect(frame).toHaveAttribute('data-opportunity-best-tone', 'setup');
        await expect(frame).toHaveAttribute('data-opportunity-best-impact-cue', 'Stack prime');
        await expect(frame).toHaveAttribute('data-trait-mode-tone', 'setup');
        await expect(frame).toHaveAttribute('data-trait-mode-value', 'Prime route');
        await expect(frame).toHaveAttribute('data-trait-mode-detail', /Swap Sealed with Filler/);
        await expect(frame).toHaveAttribute('data-card-feedback-trait-route-tiers', /route-target:2/);
        await expect(frame).toHaveAttribute('data-card-feedback-trait-route-intensities', /setup:2/);
        await expect(frame).toHaveAttribute('data-card-feedback-shot-map', 'route-setup:2');
        await expect(frame).toHaveAttribute('data-opportunity-best-detail', /Use swap to connect route/);
        await expect(page.getByTestId('trait-mode-cue')).toContainText('Trait mode');
        await expect(page.getByTestId('trait-mode-cue')).toContainText('Prime route');
        await expect(page.getByTestId('trait-mode-cue')).toContainText('Use swap to connect route');
        await expect(page.getByTestId('trait-mode-cue')).toHaveAccessibleName(/Swap Sealed with Filler/i);
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('trait-mode-cue'), 8);
        await expect(page.getByTestId('chain-opportunity-chip')).toContainText('Use swap');
        await expect(page.getByTestId('chain-opportunity-beat')).toContainText('Prime beat');
        await expect(page.getByTestId('chain-opportunity-beat')).toContainText('Use swap');
        await expect(page.getByTestId('chain-opportunity-beat')).toHaveAttribute('data-chain-beat-tier', 'setup');
        await expect(page.getByTestId('chain-opportunity-beat')).toHaveAttribute(
            'aria-label',
            'Prime beat: Prime route. 2 beats. Use swap.'
        );
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('chain-opportunity-beat'), 8);
        await expect(page.getByTestId('chain-opportunity-next-action')).toHaveAttribute(
            'data-chain-next-action',
            'prime-route'
        );
        await expect(page.getByTestId('chain-opportunity-next-action')).toHaveAttribute(
            'data-chain-next-action-tone',
            'setup'
        );
        await expect(page.getByTestId('chain-opportunity-next-action')).toContainText('Prime');
        await expect(page.getByTestId('chain-opportunity-next-action')).toContainText('Swap Sealed with Filler');
        await expect(page.getByTestId('chain-opportunity-next-action')).toHaveAttribute(
            'aria-label',
            /Next chain action\. Prime\..*Swap Sealed with Filler/i
        );
        await expect(page.getByTestId('chain-opportunity-shot-map')).toHaveAttribute(
            'data-chain-shot-map-primary',
            'route-setup'
        );
        await expect(page.getByTestId('chain-opportunity-shot-map')).toContainText('Shot map');
        await expect(page.getByTestId('chain-opportunity-shot-map')).toContainText('Set');
        await expect(page.getByTestId('chain-opportunity-shot-map')).toContainText('Setup lane');
        await expect(page.getByTestId('chain-opportunity-beat-map')).toHaveAttribute('data-card-beat-primary', 'setup');
        await expect(page.getByTestId('chain-opportunity-beat-map')).toHaveAttribute(
            'aria-label',
            'Card beat map. Prime: 2. 2-beat set route.'
        );
        await expect(page.getByTestId('chain-opportunity-beat-map')).toContainText('Beat map');
        await expect(page.getByTestId('chain-opportunity-beat-map')).toContainText('Prime');
        await expect(page.getByTestId('chain-opportunity-beat-map')).toContainText('2-beat set route');
        await expect(
            page.getByTestId('chain-opportunity-beat-map').locator('[data-card-beat-tier="setup"] [data-card-beat-pip]')
        ).toHaveCount(2);
        await expect(page.getByTestId('chain-opportunity-beat-map')).toContainText('set route');
        await expectLocatorFullyInWindowViewport(page, page.getByTestId('chain-opportunity-beat-map'), 8);
        await page.getByTestId('tile-board-application').focus();
        await expect(page.getByTestId('tile-board-live-region')).toContainText('Beat: prime.');
        await expect(page.getByTestId('tile-board-live-region')).toContainText('Set this route up.');
        await expect(page.getByTestId('tile-board-live-region')).toContainText('Swap Sealed with Filler');
        await expect(frame).toHaveAttribute('data-chain-sequence-tone', 'setup');
        await expect(frame).toHaveAttribute('data-chain-sequence-first', /Swap Sealed with Filler/);
        await expect(frame).toHaveAttribute('data-chain-sequence-then', 'Match lit route');
        await expect(frame).toHaveAttribute('data-chain-sequence-keep', 'x4 +1 shard in 1 match');
        await expect(page.getByTestId('chain-opportunity-sequence-cue')).toContainText('First');
        await expect(page.getByTestId('chain-opportunity-sequence-cue')).toContainText('Match lit route');
        await expect(page.getByTestId('chain-opportunity-sequence-cue')).toContainText('x4 +1 shard in 1 match');
        await expect(page.getByTestId('chain-opportunity-marker-key')).toContainText('Prime');
        await expect(page.getByTestId('chain-opportunity-marker-key')).toHaveAttribute(
            'data-chain-marker-intensity',
            'setup'
        );
        await expect(page.getByTestId('chain-marker-intensity')).toContainText('Prime');
        await expect(page.getByTestId('chain-marker-intensity')).toContainText('Prime payoff');
        await expect(page.getByTestId('chain-opportunity-meter')).toHaveAttribute('data-chain-meter-tone', 'setup');
        await expect(page.getByTestId('chain-opportunity-meter')).toContainText('Prime');
        await expect(page.getByTestId('chain-opportunity-meter')).toContainText('2');
        await expect(page.getByTestId('chain-opportunity-meter')).toContainText('Prime');
        await expect(page.getByTestId('chain-opportunity-meter')).toContainText('Swap Sealed with Filler');
        await expect(page.getByTestId('chain-opportunity-meter')).toHaveAttribute(
            'aria-label',
            /Chain board: Prime x2\..*Swap Sealed with Filler/i
        );
        await expect(page.getByTestId('board-opportunity-chain')).toContainText('Use swap');
        await expect(page.getByTestId('board-opportunity-chain')).toContainText('Stack prime');
        await expect(page.getByTestId('hud-trait-route-best-tool')).toContainText('Best tool: Swap');
        await expect(page.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-cue', 'Route chain');
        await expect(page.getByTestId('hud-match-chain')).toHaveAttribute('data-chain-lane-tone', 'route');
        await expect(page.getByTestId('hud-chain-lane-cue')).toContainText('Route chain');
        await expect(page.getByTestId('hud-reward-perk-strip')).toHaveAttribute(
            'data-reward-perk-focus-action',
            'Cash perk'
        );
        await expect(page.getByTestId('hud-reward-perk-strip')).toHaveAttribute(
            'data-reward-perk-focus-id',
            'trait_streak_toolkit'
        );
        await expect(page.getByTestId('hud-reward-perk-strip')).toHaveAttribute(
            'data-reward-perk-beat-tier',
            'cashout'
        );
        await expect(page.getByTestId('hud-reward-perk-focus')).toHaveAttribute(
            'data-reward-perk-focus-tone',
            'armed'
        );
        await expect(page.getByTestId('hud-reward-perk-focus')).toContainText('Cash perk');
        await expect(page.getByTestId('hud-reward-perk-focus')).toContainText('Trait cash');
        await expect(page.getByTestId('hud-reward-perk-focus')).toContainText('Trait cashout armed');
        await expect(page.getByTestId('hud-reward-perk-beat')).toContainText('Cashout beat');
        await expect(page.getByTestId('tile-swap-setup-badge')).toContainText('Best tool');
        await expect(page.getByTestId('tile-swap-intent-chip')).toContainText('Best tool');
        await expect(page.getByTestId('row-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Route cashout');
        await expect(page.getByTestId('tile-swap-payoff-chip')).toHaveAttribute('data-power-cue', 'Route cashout');
        await expect(page.getByTestId('tile-swap-payoff-chip')).toContainText('Create route');
        await expect(page.getByLabel(/Swap two hidden tiles/i)).toHaveAccessibleName(/Impact cue: Route cashout/i);

        const states = await readCardFeedbackStates(page);
        expect(states.get('chain-setup') ?? 0, 'chain setup marker count').toBeGreaterThanOrEqual(2);
        expect(states.get('trait-route-target') ?? 0, 'trait route target marker count').toBeGreaterThanOrEqual(2);
        const markerShapes = await readCardFeedbackMarkerShapes(page);
        expect(markerShapes.get('swap-target-crossbar') ?? 0, 'swap target marker shape count').toBeGreaterThanOrEqual(2);
    });

    for (const viewport of [
        { name: 'desktop', width: 1440, height: 900 },
        { name: 'mobile', width: 390, height: 844 }
    ] as const) {
        test(`${viewport.name} trap reveal resolves immediately and stays playable`, async ({ page }) => {
            test.setTimeout(150_000);
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeRunWithTrapCard');
            await expectGameplayReady(page);
            await waitForBoardPlayPhase(page);

            const frame = page.getByTestId('tile-board-frame');
            await page.screenshot({
                path: `test-results/trap-card-ux/${viewport.name}-trap-before-reveal.png`,
                animations: 'disabled'
            });

            const trapSlot = await firstSlotFromAttr(page, 'data-e2e-hidden-trap-slots');
            expect(trapSlot, 'activeRunWithTrapCard fixture should expose a hidden trap slot in dev mode').not.toBeNull();
            const beforeResolvedTrapCount = Number.parseInt(
                (await frame.getAttribute('data-dungeon-resolved-trap-count')) ?? '0',
                10
            );

            await flipTileAtGridCellKeyboard(page, trapSlot!.row, trapSlot!.col);

            await expect(frame).toHaveAttribute('data-board-run-status', 'playing');
            await expect
                .poll(
                    async () =>
                        Number.parseInt((await frame.getAttribute('data-dungeon-resolved-trap-count')) ?? '0', 10),
                    { timeout: 15_000 }
                )
                .toBeGreaterThan(beforeResolvedTrapCount);
            await expect(frame).toHaveAttribute('data-selected-tile-count', '0');
            await expect(frame).toHaveAttribute('data-dungeon-resolved-trap-slots', /\d+,\d+;\d+,\d+/);
            await expect(page.getByRole('status').filter({ hasText: /Trap resolved/i })).toBeVisible();
            await expect(frame).toHaveAttribute('data-dungeon-trap-resolution-message', /Trap resolved/i);

            await page.screenshot({
                path: `test-results/trap-card-ux/${viewport.name}-trap-resolved-playable.png`,
                animations: 'disabled'
            });

            const nextSlot = await firstSlotFromAttr(page, 'data-e2e-pickable-hidden-slots');
            expect(nextSlot, 'board should still have a pickable hidden tile after trap resolution').not.toBeNull();
            await flipTileAtGridCellKeyboard(page, nextSlot!.row, nextSlot!.col);
            await expect(frame).toHaveAttribute('data-board-run-status', 'playing');
            await expect(frame).toHaveAttribute('data-selected-tile-count', '1');
        });
    }
});

async function expectBoardKeepsPriority(page: Page): Promise<void> {
    const metrics = await page.evaluate(() => {
        const board = document.querySelector('[data-testid="tile-board-frame"]')?.getBoundingClientRect();
        const shell = document.querySelector('[data-testid="game-shell"]')?.getBoundingClientRect();
        if (!board || !shell) {
            return null;
        }
        return {
            boardHeight: board.height,
            shellHeight: shell.height
        };
    });

    expect(metrics).not.toBeNull();
    expect(
        metrics!.boardHeight / metrics!.shellHeight,
        `board should keep at least 45% of the gameplay shell height; got ${metrics!.boardHeight}/${metrics!.shellHeight}`
    ).toBeGreaterThanOrEqual(0.45);
}

async function expectLocatorStartsWithinWindowViewport(page: Page, locator: Locator, epsilon = 6): Promise<void> {
    const box = await locator.evaluate((element, eps) => {
        const r = element.getBoundingClientRect();
        return {
            eps,
            left: r.left,
            right: r.right,
            top: r.top,
            vh: window.innerHeight,
            vw: window.innerWidth
        };
    }, epsilon);
    expect(
        box.top >= -box.eps && box.top <= box.vh + box.eps && box.left >= -box.eps && box.right <= box.vw + box.eps,
        `expected locator to start in viewport; got top=${box.top} left=${box.left} right=${box.right} for ${box.vw}x${box.vh}`
    ).toBeTruthy();
}

async function readCardFeedbackStates(page: Page): Promise<Map<string, number>> {
    const raw = (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')) ?? '';
    return parseCountAttr(raw);
}

async function readCardFeedbackMarkerShapes(page: Page): Promise<Map<string, number>> {
    const raw = (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-marker-shapes')) ?? '';
    return parseCountAttr(raw);
}

function parseCountAttr(raw: string): Map<string, number> {
    const states = new Map<string, number>();
    for (const entry of raw.split(';').filter(Boolean)) {
        const [key, count] = entry.split(':');
        if (key) {
            states.set(key, Number.parseInt(count ?? '0', 10));
        }
    }
    return states;
}

async function firstSlotFromAttr(page: Page, attr: string): Promise<{ row: number; col: number } | null> {
    const raw = (await page.getByTestId('tile-board-frame').getAttribute(attr)) ?? '';
    const [first] = raw.split(';').filter(Boolean);
    if (!first) {
        return null;
    }
    const [row, col] = first.split(',').map((value) => Number.parseInt(value, 10));
    return Number.isFinite(row) && Number.isFinite(col) ? { row, col } : null;
}
