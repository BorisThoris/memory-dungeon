import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { forceCoarsePointerMedia } from './mobileTouchHelpers';
import { readDevPairPositionsFromFrame, type MemorizePairPositions } from './memorizeSnapshot';
import {
    flipTileAtGridCellKeyboard,
    readFrameHiddenTileCount,
    readTileClientRectAtGrid,
    waitForBoardPlayPhase
} from './tileBoardGameFlow';
import {
    completeLevel1Play,
    expectNoHorizontalOverflow,
    openLevel1Play,
    waitLevel1PlayReady,
    waitLevel1VisualReady
} from './visualScreenHelpers';
import {
    expectGameplayReady,
    openPlayablePathFixture,
    openRunMenuItem
} from './playablePathHelpers';

type GridPosition = { col: number; row: number };

const AUDIT_ROOT = process.env.VISUAL_CAPTURE_ROOT?.trim()
    ? resolve(process.cwd(), process.env.VISUAL_CAPTURE_ROOT.trim())
    : join(process.cwd(), 'test-results', 'gameplay-visual-audit');

const VIEWPORTS = [
    { id: 'desktop-1440x900', width: 1440, height: 900, coarse: false },
    { id: 'mobile-390x844', width: 390, height: 844, coarse: true }
] as const;

function orderedPairs(pairs: MemorizePairPositions | null): [GridPosition[], GridPosition[]] {
    const values = Object.values(pairs ?? {})
        .filter((pair): pair is GridPosition[] => pair.length === 2)
        .sort((a, b) => a[0]!.row - b[0]!.row || a[0]!.col - b[0]!.col);
    if (values.length < 2) {
        throw new Error('gameplay visual audit needs at least two visible level-1 pairs');
    }
    return [values[0]!, values[1]!];
}

async function capture(page: Page, viewportId: string, name: string): Promise<void> {
    const outDir = join(AUDIT_ROOT, viewportId);
    mkdirSync(outDir, { recursive: true });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
        animations: 'allow',
        fullPage: true,
        path: join(outDir, `${name}.png`)
    });
}

async function hoverAndFocusTile(page: Page, tile: GridPosition): Promise<void> {
    const rect = await readTileClientRectAtGrid(page, tile.row, tile.col);
    await page.mouse.move(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await page.getByTestId('tile-board-application').focus();
}

async function startPlayableAuditRun(page: Page): Promise<MemorizePairPositions | null> {
    await openLevel1Play(page);
    await waitLevel1VisualReady(page);
    return (await waitLevel1PlayReady(page)) ?? (await readDevPairPositionsFromFrame(page));
}

async function captureGameplayStates(page: Page, viewportId: string): Promise<void> {
    const pairs = await startPlayableAuditRun(page);
    const [firstPair, secondPair] = orderedPairs(pairs);
    const startingHidden = await readFrameHiddenTileCount(page);

    await capture(page, viewportId, '01-gameplay-idle');

    await hoverAndFocusTile(page, firstPair[0]!);
    await page.waitForTimeout(160);
    await capture(page, viewportId, '02-card-hover-focus');

    await flipTileAtGridCellKeyboard(page, firstPair[0]!.row, firstPair[0]!.col);
    await expectCardFeedbackState(page, /flipped:1/);
    await flipTileAtGridCellKeyboard(page, secondPair[0]!.row, secondPair[0]!.col);
    await expectLastResolutionFeedback(page, /mismatch:2/);
    await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-card-feedback-reduced-motion', 'static-state-cues');
    await capture(page, viewportId, '03-mismatch-resolve');
    await waitForBoardPlayPhase(page);
    await expect.poll(async () => readFrameHiddenTileCount(page), { timeout: 20_000 }).toBe(startingHidden);

    await flipTileAtGridCellKeyboard(page, firstPair[0]!.row, firstPair[0]!.col);
    await expectCardFeedbackState(page, /flipped:1/);
    await flipTileAtGridCellKeyboard(page, firstPair[1]!.row, firstPair[1]!.col);
    await expectLastResolutionFeedback(page, /match:2/);
    await capture(page, viewportId, '04-match-resolve');
    await waitForBoardPlayPhase(page);
}

async function captureTrapFeedbackState(page: Page, viewportId: string): Promise<void> {
    await openPlayablePathFixture(page, 'activeRunWithHazards');
    await expectGameplayReady(page);
    await page.getByText(/^Info$/i).click({ force: true });
    await expect(page.getByTestId('hud-hazard-tiles')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('hud-in-run-cause-strip')).toBeVisible({ timeout: 20_000 });
    await capture(page, viewportId, '05-trap-feedback');
}

async function expectCardFeedbackState(page: Page, pattern: RegExp): Promise<void> {
    await expect
        .poll(async () => (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-states')) ?? '')
        .toMatch(pattern);
}

async function expectLastResolutionFeedback(page: Page, pattern: RegExp): Promise<void> {
    await expect
        .poll(async () => (await page.getByTestId('tile-board-frame').getAttribute('data-card-feedback-last-resolution')) ?? '')
        .toMatch(pattern);
}

async function captureOverlayStates(page: Page, viewportId: string): Promise<void> {
    await startPlayableAuditRun(page);

    await page.keyboard.press('p');
    const pause = page.getByRole('dialog', { name: /run paused/i });
    await expect(pause).toBeVisible({ timeout: 15_000 });
    await capture(page, viewportId, '05-pause-modal');
    await pause.getByRole('button', { name: /^resume$/i }).click();
    await expect(pause).toBeHidden({ timeout: 15_000 });

    await page.getByRole('button', { name: /run settings \(toolbar\)/i }).click({ force: true });
    const runSettings = page.getByRole('dialog', { name: /run settings/i });
    await expect(runSettings).toBeVisible({ timeout: 15_000 });
    await capture(page, viewportId, '06-run-settings-modal');
    await runSettings.getByRole('button', { name: /^back$/i }).click();
    await expect(runSettings).toBeHidden({ timeout: 15_000 });

    await openRunMenuItem(page, 'inventory');
    await expect(page.getByRole('region', { name: /inventory/i })).toBeVisible({ timeout: 20_000 });
    await capture(page, viewportId, '07-in-run-inventory');
    await page.getByRole('button', { name: /^back$/i }).click();

    await openRunMenuItem(page, 'codex');
    await expect(page.getByRole('region', { name: /codex/i })).toBeVisible({ timeout: 20_000 });
    await capture(page, viewportId, '08-in-run-codex');

    await openPlayablePathFixture(page, 'relicDraft');
    await expect(page.getByTestId('game-relic-offer-overlay')).toBeVisible({ timeout: 30_000 });
    await capture(page, viewportId, '09-relic-offer');
}

async function captureProgressionStates(page: Page, viewportId: string): Promise<void> {
    await openLevel1Play(page);
    await clearLevelForAudit(page);
    const floorCleared = page.getByRole('dialog', { name: /floor cleared/i });
    await expect(floorCleared).toBeVisible({ timeout: 20_000 });
    await capture(page, viewportId, '09-floor-cleared');

    const shopButton = floorCleared.getByRole('button', { name: /visit shop/i });
    if (await shopButton.isVisible().catch(() => false)) {
        await shopButton.click();
        await expect(page.getByTestId('shop-screen')).toBeVisible({ timeout: 20_000 });
        await capture(page, viewportId, '10-shop');
    }

    const continueButton = page.getByRole('button', { name: /^continue/i }).first();
    if (await continueButton.isVisible().catch(() => false)) {
        await continueButton.click();
    }

    const tipsRegion = page.getByRole('region', { name: /memory dungeon tips/i });
    const achievementToast = tipsRegion.locator('[data-crn-stack-key="achievement:ACH_FIRST_CLEAR"]');
    await expect(achievementToast).toBeVisible({ timeout: 20_000 });
    await capture(page, viewportId, '11-achievement-toast');
}

async function proceedThroughAuditExit(page: Page): Promise<boolean> {
    const exitDialog = page.getByRole('dialog', { name: /unlocked exit/i });
    if (!(await exitDialog.isVisible().catch(() => false))) {
        return false;
    }
    await exitDialog.getByRole('button', { name: /^proceed$/i }).click();
    await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible({ timeout: 20_000 });
    return true;
}

async function clearLevelForAudit(page: Page): Promise<void> {
    const initialPairs = (await waitLevel1PlayReady(page)) ?? (await readDevPairPositionsFromFrame(page));
    const pairPositions = Object.values(initialPairs ?? {}).filter((pair): pair is GridPosition[] => pair.length === 2);
    if (pairPositions.length < 2) {
        await completeLevel1Play(page, null);
        return;
    }

    for (const pair of pairPositions) {
        if (await proceedThroughAuditExit(page)) {
            return;
        }
        await waitForBoardPlayPhase(page);
        await flipTileAtGridCellKeyboard(page, pair[0]!.row, pair[0]!.col);
        await flipTileAtGridCellKeyboard(page, pair[1]!.row, pair[1]!.col);
        await page.waitForTimeout(1_100);
    }

    if (await proceedThroughAuditExit(page)) {
        return;
    }

    await completeLevel1Play(page, null);
}

async function waitForMismatchBurnSettle(page: Page, expectedHidden: number): Promise<void> {
    const expeditionOver = page.getByText(/Expedition Over/i);
    await expect
        .poll(
            async () => {
                if (await expeditionOver.isVisible().catch(() => false)) {
                    return 'over';
                }
                const frame = page.getByTestId('tile-board-frame');
                if ((await frame.count()) === 0) {
                    return (await expeditionOver.isVisible().catch(() => false)) ? 'over' : 'no-board';
                }
                const status = await frame.getAttribute('data-board-run-status');
                const hidden = await readFrameHiddenTileCount(page);
                return status === 'playing' && hidden === expectedHidden ? 'ready' : `${status}:${hidden}`;
            },
            { timeout: 24_000 }
        )
        .toMatch(/^(over|ready)$/);
}

async function forceGameOverForAudit(page: Page, pairs: MemorizePairPositions | null): Promise<void> {
    const [firstPair, secondPair] = orderedPairs(pairs);
    const mismatchA = firstPair[0]!;
    const mismatchB = secondPair[0]!;
    const expectedHidden = await readFrameHiddenTileCount(page);
    const expeditionOver = page.getByText(/Expedition Over/i);

    for (let i = 0; i < 12; i += 1) {
        if (await expeditionOver.isVisible().catch(() => false)) {
            return;
        }
        await waitForBoardPlayPhase(page);
        await flipTileAtGridCellKeyboard(page, mismatchA.row, mismatchA.col);
        await flipTileAtGridCellKeyboard(page, mismatchB.row, mismatchB.col);
        await waitForMismatchBurnSettle(page, expectedHidden);
    }
}

async function captureGameOverState(page: Page, viewportId: string): Promise<void> {
    await openLevel1Play(page);
    const pairs = (await waitLevel1PlayReady(page)) ?? (await readDevPairPositionsFromFrame(page));
    await forceGameOverForAudit(page, pairs);
    await expect(page.getByText(/Expedition Over/i)).toBeVisible({ timeout: 20_000 });
    await capture(page, viewportId, '12-game-over');
}

test.describe.configure({ mode: 'serial' });

for (const viewport of VIEWPORTS) {
    test.describe(`gameplay visual audit @ ${viewport.id}`, () => {
        test.beforeEach(async ({ page }) => {
            if (viewport.coarse) {
                await forceCoarsePointerMedia(page);
            }
            await page.setViewportSize({ width: viewport.width, height: viewport.height });
        });

        test('captures live gameplay card states', async ({ page }) => {
            test.setTimeout(140_000);
            await captureGameplayStates(page, viewport.id);
        });

        test('captures active trap feedback', async ({ page }) => {
            test.setTimeout(90_000);
            await captureTrapFeedbackState(page, viewport.id);
        });

        test('captures in-run overlays', async ({ page }) => {
            test.setTimeout(140_000);
            await captureOverlayStates(page, viewport.id);
        });

        test('captures floor clear, shop, and achievement toast', async ({ page }) => {
            test.setTimeout(180_000);
            await captureProgressionStates(page, viewport.id);
        });

        test('captures game over', async ({ page }) => {
            test.setTimeout(240_000);
            await captureGameOverState(page, viewport.id);
        });
    });
}
