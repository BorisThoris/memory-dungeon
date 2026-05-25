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

    test('board marker contract and live hazard states are exposed for readability audits', async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await openPlayablePathFixture(page, 'activeRunWithHazards');
        await expectGameplayReady(page);

        const frame = page.getByTestId('tile-board-frame');
        await expect(frame).toHaveAttribute(
            'data-card-feedback-marker-contract',
            /hidden selected matched disabled enemy-occupied boss-marked trap-armed trap-resolved relic objective/
        );

        const states = await readCardFeedbackStates(page);
        for (const expected of ['hidden', 'pickable'] as const) {
            expect(states.get(expected) ?? 0, `${expected} marker count`).toBeGreaterThan(0);
        }
        expect((states.get('hazard') ?? 0) + (states.get('relic') ?? 0) + (states.get('objective') ?? 0)).toBeGreaterThan(0);
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

async function readCardFeedbackStates(page: Page): Promise<Map<string, number>> {
    const raw = (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')) ?? '';
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
