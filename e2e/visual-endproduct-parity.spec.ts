import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readDevPairPositionsFromFrame, type MemorizePairPositions } from './memorizeSnapshot';
import {
    flipTileAtGridCellViaDevHook,
    readFrameHiddenTileCount,
    readTileClientRectAtGrid,
    type E2eClientRect
} from './tileBoardGameFlow';
import {
    buildVisualSaveJson,
    expectNoHorizontalOverflow,
    getEndproductParityCaptureDir,
    openLevel1Play,
    openLevel1PlayWithSave
} from './visualScreenHelpers';

type GridPosition = { col: number; row: number };
type CapturePadding = Partial<Record<'bottom' | 'left' | 'right' | 'top', number>>;

const PARITY_VIEWPORT = { width: 1440, height: 900 } as const;
const FLIP_TRANSITION_CAPTURE_MS = 40;
const FLIP_SETTLE_CAPTURE_MS = 260;
const HOVER_SETTLE_MS = 120;
const MATCH_INTERACTION_CAPTURE_MS = 180;
const MISMATCH_INTERACTION_CAPTURE_MS = 90;
const SINGLE_CARD_PADDING: Required<CapturePadding> = { top: 36, right: 34, bottom: 36, left: 34 };
const INTERACTION_PADDING: Required<CapturePadding> = { top: 86, right: 56, bottom: 46, left: 56 };

function sortGridPositions(positions: GridPosition[]): GridPosition[] {
    return [...positions].sort((a, b) => a.row - b.row || a.col - b.col);
}

function getCapturePairs(pairs: MemorizePairPositions | null): {
    firstPair: [GridPosition, GridPosition];
    mismatchPair: [GridPosition, GridPosition];
    secondPair: [GridPosition, GridPosition];
} {
    expect(pairs, 'DEV pair positions should be available on tile-board-frame').not.toBeNull();
    const orderedPairs = Object.values(pairs ?? {})
        .filter((pair): pair is [GridPosition, GridPosition] => pair.length === 2)
        .map((pair) => sortGridPositions(pair) as [GridPosition, GridPosition])
        .sort((a, b) => a[0].row - b[0].row || a[0].col - b[0].col);

    expect(orderedPairs.length, 'Need at least two deterministic level-1 pairs').toBeGreaterThanOrEqual(2);

    return {
        firstPair: orderedPairs[0]!,
        mismatchPair: [orderedPairs[0]![0], orderedPairs[1]![0]],
        secondPair: orderedPairs[1]!
    };
}

function expandRect(rect: E2eClientRect, padding: CapturePadding): E2eClientRect {
    const top = padding.top ?? 0;
    const right = padding.right ?? 0;
    const bottom = padding.bottom ?? 0;
    const left = padding.left ?? 0;

    return {
        top: rect.top - top,
        right: rect.right + right,
        bottom: rect.bottom + bottom,
        left: rect.left - left,
        width: rect.width + left + right,
        height: rect.height + top + bottom
    };
}

function unionRects(rects: readonly E2eClientRect[]): E2eClientRect {
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return {
        top,
        right,
        bottom,
        left,
        width: right - left,
        height: bottom - top
    };
}

function toClip(page: Page, rect: E2eClientRect): { height: number; width: number; x: number; y: number } {
    const viewport = page.viewportSize();
    expect(viewport, 'viewport should be available before clipping').not.toBeNull();

    const x = Math.max(0, Math.floor(rect.left));
    const y = Math.max(0, Math.floor(rect.top));
    const width = Math.max(2, Math.min(Math.ceil(rect.width), viewport!.width - x));
    const height = Math.max(2, Math.min(Math.ceil(rect.height), viewport!.height - y));

    return { x, y, width, height };
}

async function screenshotLocator(locator: Locator, fileName: string): Promise<void> {
    await locator.screenshot({
        path: join(getEndproductParityCaptureDir(), fileName),
        animations: 'disabled'
    });
}

async function screenshotClip(
    page: Page,
    fileName: string,
    rect: E2eClientRect,
    animations: 'allow' | 'disabled'
): Promise<void> {
    await page.screenshot({
        path: join(getEndproductParityCaptureDir(), fileName),
        clip: toClip(page, rect),
        animations
    });
}

async function screenshotSingleTile(
    page: Page,
    fileName: string,
    tile: GridPosition,
    animations: 'allow' | 'disabled',
    padding: CapturePadding = SINGLE_CARD_PADDING
): Promise<void> {
    const rect = await readTileClientRectAtGrid(page, tile.row, tile.col);
    await screenshotClip(page, fileName, expandRect(rect, padding), animations);
}

async function screenshotTilePair(
    page: Page,
    fileName: string,
    tiles: readonly [GridPosition, GridPosition],
    animations: 'allow' | 'disabled',
    padding: CapturePadding = INTERACTION_PADDING
): Promise<void> {
    const rects = await Promise.all(tiles.map((tile) => readTileClientRectAtGrid(page, tile.row, tile.col)));
    await screenshotClip(page, fileName, expandRect(unionRects(rects), padding), animations);
}

async function parkPointer(page: Page): Promise<void> {
    await page.mouse.move(8, 8);
}

async function hoverTile(page: Page, tile: GridPosition): Promise<void> {
    const rect = await readTileClientRectAtGrid(page, tile.row, tile.col);
    await page.mouse.move(rect.left + rect.width / 2, rect.top + rect.height / 2);
    await page.waitForTimeout(HOVER_SETTLE_MS);
}

async function openParityFixture(
    page: Page,
    _fixture: 'arcade' | 'dailyParasite' | 'resolvingMismatch',
    reduceMotion = true
): Promise<void> {
    await page.setViewportSize(PARITY_VIEWPORT);
    await openLevel1PlayWithSave(page, buildVisualSaveJson(true, reduceMotion));
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId('tile-board-frame')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 25_000 });
    await expectNoHorizontalOverflow(page);
}

function buildActionCaptureSaveJson(): string {
    const parsed = JSON.parse(buildVisualSaveJson(true, false)) as {
        settings: Record<string, unknown>;
    };
    parsed.settings = {
        ...parsed.settings,
        boardBloomEnabled: true,
        graphicsQuality: 'high',
        reduceMotion: false,
        resolveDelayMultiplier: 2.4
    };
    return JSON.stringify(parsed);
}

async function openParityFixtureWithSave(
    page: Page,
    _fixture: 'arcade' | 'dailyParasite' | 'resolvingMismatch',
    saveJson: string
): Promise<void> {
    await page.setViewportSize(PARITY_VIEWPORT);
    await openLevel1PlayWithSave(page, saveJson);
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByTestId('tile-board-frame')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 25_000 });
    await expectNoHorizontalOverflow(page);
}

/**
 * Element-scoped PNGs for side-by-side comparison with `docs/ENDPRODUCTIMAGE.png`.
 * Run: `yarn capture:endproduct-parity` (writes under `docs/visual-capture/endproduct-parity/`) or default
 * `test-results/endproduct-parity/` without env.
 *
 * Stable gameplay-panel basenames:
 * `main-game-screen`, `top-bar-details`, `bottom-action-dock`, `card-face-down`, `card-hover`, `card-flipped`,
 * `card-matched`, `interaction-flip`, `interaction-match`, `interaction-mismatch`.
 */
test.describe('Endproduct parity captures', () => {
    test.describe.configure({ mode: 'serial' });

    test('1440x900 gameplay shell + panel crops (dailyParasite)', async ({ page }) => {
        await openParityFixture(page, 'dailyParasite');

        const hud = page.getByTestId('game-hud');
        const frame = page.getByTestId('tile-board-frame');
        const actionDock = page.getByTestId('game-action-dock');
        await expect(hud).toBeVisible();
        await expect(frame).toBeVisible();
        await expect(actionDock).toBeVisible();

        await page.screenshot({
            path: join(getEndproductParityCaptureDir(), 'main-game-screen.png'),
            fullPage: true,
            animations: 'disabled'
        });
        await screenshotLocator(hud, 'top-bar-details.png');
        await screenshotLocator(actionDock, 'bottom-action-dock.png');

        await hud.screenshot({ path: join(getEndproductParityCaptureDir(), 'hud-1440x900.png'), animations: 'disabled' });
        await frame.screenshot({
            path: join(getEndproductParityCaptureDir(), 'tile-board-1440x900.png'),
            animations: 'disabled'
        });
    });

    test('1280x720 HUD + tile board (dailyParasite)', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 720 });
        const dir = getEndproductParityCaptureDir();
        await openLevel1Play(page);
        await expectNoHorizontalOverflow(page);

        const hud = page.getByTestId('game-hud');
        const frame = page.getByTestId('tile-board-frame');
        await expect(hud).toBeVisible();
        await expect(frame).toBeVisible();
        await hud.screenshot({ path: join(dir, 'hud-1280x720.png'), animations: 'disabled' });
        await frame.screenshot({ path: join(dir, 'tile-board-1280x720.png'), animations: 'disabled' });
    });

    test('1440x900 HUD + tile board (arcade fixture)', async ({ page }) => {
        await openParityFixture(page, 'arcade');

        const hud = page.getByTestId('game-hud');
        const frame = page.getByTestId('tile-board-frame');
        await expect(hud).toBeVisible();
        await expect(frame).toBeVisible();
        await hud.screenshot({
            path: join(getEndproductParityCaptureDir(), 'hud-1440x900-arcade.png'),
            animations: 'disabled'
        });
        await frame.screenshot({
            path: join(getEndproductParityCaptureDir(), 'tile-board-1440x900-arcade.png'),
            animations: 'disabled'
        });
    });

    test('1440x900 card states (arcade fixture)', async ({ page }) => {
        test.setTimeout(90_000);
        await openParityFixtureWithSave(page, 'arcade', buildActionCaptureSaveJson());
        await parkPointer(page);

        const { firstPair } = getCapturePairs(await readDevPairPositionsFromFrame(page));
        const focusTile = firstPair[0];

        await screenshotSingleTile(page, 'card-face-down.png', focusTile, 'disabled');

        await hoverTile(page, focusTile);
        await screenshotSingleTile(page, 'card-hover.png', focusTile, 'disabled');

        await flipTileAtGridCellViaDevHook(page, focusTile.row, focusTile.col);
        await page.waitForTimeout(FLIP_TRANSITION_CAPTURE_MS);
        await screenshotSingleTile(page, 'interaction-flip.png', focusTile, 'allow', {
            top: 54,
            right: 44,
            bottom: 54,
            left: 44
        });

        await page.waitForTimeout(FLIP_SETTLE_CAPTURE_MS);
        await screenshotSingleTile(page, 'card-flipped.png', focusTile, 'disabled', {
            top: 42,
            right: 38,
            bottom: 42,
            left: 38
        });
    });

    test('1440x900 interaction moments + matched state (arcade fixture)', async ({ page }) => {
        test.setTimeout(90_000);
        const actionSaveJson = buildActionCaptureSaveJson();
        await openParityFixtureWithSave(page, 'arcade', actionSaveJson);
        await parkPointer(page);

        const { firstPair, mismatchPair } = getCapturePairs(await readDevPairPositionsFromFrame(page));
        await flipTileAtGridCellViaDevHook(page, firstPair[0].row, firstPair[0].col);
        await flipTileAtGridCellViaDevHook(page, firstPair[1].row, firstPair[1].col);
        await expect.poll(async () => readFrameHiddenTileCount(page)).toBe(2);
        await page.waitForTimeout(MATCH_INTERACTION_CAPTURE_MS);
        await screenshotTilePair(page, 'interaction-match.png', firstPair, 'allow');

        await expect
            .poll(async () => ({
                hidden: await readFrameHiddenTileCount(page),
                status: await page.getByTestId('tile-board-frame').getAttribute('data-board-run-status')
            }))
            .toEqual({ hidden: 2, status: 'playing' });
        await screenshotSingleTile(page, 'card-matched.png', firstPair[0], 'disabled', {
            top: 42,
            right: 40,
            bottom: 42,
            left: 40
        });

        await openParityFixtureWithSave(page, 'resolvingMismatch', actionSaveJson);
        await parkPointer(page);
        await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-board-run-status', 'resolving');
        await page.waitForTimeout(MISMATCH_INTERACTION_CAPTURE_MS);
        await screenshotTilePair(page, 'interaction-mismatch.png', mismatchPair, 'allow');
    });
});
