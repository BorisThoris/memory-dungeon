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
import { flipTileAtGridCellKeyboard } from './tileBoardGameFlow';

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
            test.setTimeout(90_000);
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

    test('trap cards resolve immediately from first reveal with board-local feedback', async ({ page }, testInfo) => {
        test.setTimeout(120_000);

        for (const viewport of [
            { name: 'desktop', width: 1280, height: 800 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
            await openPlayablePathFixture(page, 'activeTrapRun');
            await expectGameplayReady(page);
            await page.screenshot({
                fullPage: true,
                path: testInfo.outputPath(`trap-card-before-reveal-${viewport.name}.png`)
            });

            const trapPick = await findFirstRevealTrapPick(page);
            expect(trapPick, `${viewport.name} fixture should expose a hidden trap pair`).not.toBeNull();

            await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-board-run-status', 'playing');
            await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-trap-card-resolution-feedback', 'visible');
            await expect(page.getByTestId('trap-resolution-toast')).toHaveAttribute('data-visible', 'true');
            await expect(page.getByTestId('trap-resolution-toast')).toContainText(/Trap sprung and resolved/i);
            await page.screenshot({
                fullPage: true,
                path: testInfo.outputPath(`trap-card-resolved-${viewport.name}.png`)
            });

            const nextPick = await findDifferentPairPick(page, trapPick!.pairKey);
            expect(nextPick, `${viewport.name} fixture should keep a playable follow-up tile`).not.toBeNull();
            await flipTileAtGridCellKeyboard(page, nextPick!.row, nextPick!.col);
            await expect
                .poll(() => page.getByTestId('tile-board-frame').getAttribute('data-board-run-status'))
                .toBe('playing');
        }
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

interface PairPick {
    pairKey: string;
    row: number;
    col: number;
}

async function readPairPicks(page: Page): Promise<PairPick[]> {
    const raw = await page.getByTestId('tile-board-frame').getAttribute('data-e2e-pair-positions');
    const parsed = JSON.parse(raw ?? '{}') as Record<string, { row: number; col: number }[]>;
    return Object.entries(parsed)
        .filter(([, positions]) => positions.length >= 2)
        .map(([pairKey, positions]) => ({ pairKey, row: positions[0]!.row, col: positions[0]!.col }));
}

async function findFirstRevealTrapPick(page: Page): Promise<PairPick | null> {
    const raw = await page.getByTestId('tile-board-frame').getAttribute('data-e2e-dungeon-cards');
    const cards = JSON.parse(raw ?? '[]') as Array<
        PairPick & { dungeonCardKind: string | null; dungeonCardState: string | null; id: string }
    >;
    const pick = cards.find((card) => card.dungeonCardKind === 'trap' && card.dungeonCardState === 'hidden') ?? null;
    if (!pick) {
        return null;
    }
    const before = Number((await page.getByTestId('tile-board-frame').getAttribute('data-trap-card-resolved-count')) ?? '0');
    await flipTileAtGridCellKeyboard(page, pick.row, pick.col);
    await page.waitForFunction(
        ([expected]) => {
            const frame = document.querySelector('[data-testid="tile-board-frame"]');
            return (
                frame?.getAttribute('data-board-run-status') === 'playing' &&
                Number(frame.getAttribute('data-trap-card-resolved-count') ?? '0') > expected
            );
        },
        [before],
        { timeout: 5_000 }
    );
    return pick;
}

async function findDifferentPairPick(page: Page, excludedPairKey: string): Promise<PairPick | null> {
    const picks = await readPairPicks(page);
    return picks.find((pick) => pick.pairKey !== excludedPairKey) ?? null;
}
