import { expect, test, type Page } from '@playwright/test';
import {
    expectAppScrollportHasNoVerticalOverflow,
    expectLocatorFullyInWindowViewport,
    expectNoHorizontalOverflow
} from './visualScreenHelpers';
import {
    expectGameplayReady,
    openPlayablePathFixture
} from './playablePathHelpers';
import { readTileClientRectAtGrid, waitForBoardPlayPhase } from './tileBoardGameFlow';

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
            await openPlayablePathFixture(page, 'cascadeClump');
            await expectGameplayReady(page);

            await expectNoHorizontalOverflow(page);
            await expectAppScrollportHasNoVerticalOverflow(page, 18);
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-hud'), 8);
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('tile-board-frame'), 8);
            await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-action-dock'), 8);
            await expectBoardKeepsPriority(page);
            const labels = await page.getByTestId('hud-chain-meter').locator('[data-rung] > span:last-child').evaluateAll((nodes) =>
                nodes.map((node) => {
                    const box = node.getBoundingClientRect();
                    return { text: node.textContent, left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width };
                }).filter((box) => box.width > 0)
            );
            expect(labels.length, 'the chain ladder has visible tier names').toBeGreaterThanOrEqual(3);
            for (let i = 0; i < labels.length; i += 1) {
                for (let j = i + 1; j < labels.length; j += 1) {
                    const a = labels[i]!;
                    const b = labels[j]!;
                    const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                    const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                    expect(width > 0.5 && height > 0.5, `${a.text} overlaps ${b.text}`).toBe(false);
                }
            }

            if (viewport.width <= 430) {
                const frame = page.getByTestId('tile-board-frame');
                await expect(frame).toHaveAttribute('data-shuffle-animating', 'false');
                const columns = Number(await frame.getAttribute('data-board-columns'));
                const rows = Number(await frame.getAttribute('data-board-rows'));
                const cards = await Promise.all(Array.from({ length: columns * rows }, (_, index) =>
                    readTileClientRectAtGrid(page, Math.floor(index / columns) + 1, index % columns + 1)
                ));
                // Six columns used to leave only 36px cards on a 390px phone. Keep the gain in
                // actual WebGL pick bounds, rather than just checking the full-screen canvas.
                for (const card of cards) {
                    expect(card.width).toBeGreaterThanOrEqual(viewport.width / 10);
                    expect(card.left).toBeGreaterThanOrEqual(0);
                    expect(card.right).toBeLessThanOrEqual(viewport.width);
                }
                for (let i = 0; i < cards.length; i += 1) {
                    for (let j = i + 1; j < cards.length; j += 1) {
                        const a = cards[i]!;
                        const b = cards[j]!;
                        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                        expect(width > 0.5 && height > 0.5, `cards ${i + 1} and ${j + 1} overlap`).toBe(false);
                    }
                }
            }
        });
    }

    test('a dense active run keeps the bar, the dock and the line bounded', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'cascadeClump');
        await expectGameplayReady(page);

        await expectLocatorFullyInWindowViewport(page, page.getByTestId('game-hud'), 8);

        const powerButton = page.getByTestId('game-action-dock').getByRole('button').first();
        await powerButton.click({ force: true });
        /*
         * Arming a power used to open a teaching panel. The rebuild teaches on the board instead —
         * tutorial pair markers on the early floors — and says what to do next on the one line
         * under the bar, so that line is what has to stay readable after a press. The old check
         * was wrapped in an isVisible guard, so it had been quietly passing over nothing.
         */
        const line = page.getByTestId('run-shell-line');
        // Not guarded any more. The guard was there for the case the assertion is about — the line
        // absent after a press — so the test said nothing exactly when it mattered.
        await expect(line).toBeVisible();
        await expectLocatorFullyInWindowViewport(page, line, 8);

        await expectBoardKeepsPriority(page);
    });

    test('mobile floor clear keeps the score and the way on readable', async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'floorClearWithRouteChoices');

        // The screen opens already complete, so the floor-clear beat is up at once and the run
        // advances on its own ~1.6s later: everything here is read inside that window. No doors
        // since Gen 173 and no dialog since Gen 182 — the beat has nothing to press, so what has
        // to hold on a phone is that the whole beat, score included, sits inside the viewport.
        const floorClearBeat = page.getByTestId('floor-clear-beat');
        await expect(floorClearBeat).toBeVisible({ timeout: 10_000 });
        await expect(page.getByTestId('floor-clear-score')).toBeVisible();
        await expectLocatorFullyInWindowViewport(page, floorClearBeat, 8);
        await expectNoHorizontalOverflow(page);
    });

    test('board marker contract and live card states are exposed for readability audits', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'cascadeClump');
        await expectGameplayReady(page);

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute(
            'data-card-feedback-marker-contract',
            /hidden selected matched disabled findable trait chain-ready chain-surge chain-reward-hot chain-setup trait-combo trait-combo-surge trait-payoff-stack trait-route-target/
        );
        await expect(frame).toHaveAttribute(
            'data-card-feedback-marker-shape-contract',
            'linked-route combo-surge payoff-bar payoff-stack swap-target-crossbar followup-target'
        );

        const states = await readCardFeedbackStates(page);
        for (const expected of ['hidden', 'pickable'] as const) {
            expect(states.get(expected) ?? 0, `${expected} marker count`).toBeGreaterThan(0);
        }
    });

    test('standalone pickup rewards read as pickup cashouts on the board', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithPickupCashout');
        await expectGameplayReady(page);
        await waitForBoardPlayPhase(page);

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute('data-pickup-opportunity-count', '1');
    });

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

async function readCardFeedbackStates(page: Page): Promise<Map<string, number>> {
    const raw = (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')) ?? '';
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
