import { expect, type Page } from '@playwright/test';
import { SAVE_SCHEMA_VERSION, type GraphicsQualityPreset } from '../src/shared/contracts';
import { readDevPairPositionsFromFrame, readMemorizeSnapshot, type MemorizePairPositions } from './memorizeSnapshot';
import { dismissStartupIntro } from './startupIntroHelpers';

export const STORAGE_KEY = 'memory-dungeon-save-data';

export interface E2eClientRect {
    bottom: number;
    height: number;
    left: number;
    right: number;
    top: number;
    width: number;
}

/** @returns Hidden count from `data-hidden-tile-count`, or `-1` when `tile-board-frame` is not mounted (avoids hanging on `getAttribute`). */
export async function readFrameHiddenTileCount(page: Page): Promise<number> {
    const frame = page.getByTestId('tile-board-frame');
    if ((await frame.count()) === 0) {
        return -1;
    }
    const raw = await frame.getAttribute('data-hidden-tile-count');
    return Number.parseInt(raw ?? '0', 10);
}

/** Memorize can still report hidden tiles; picks only work in `playing`. */
export async function waitForBoardPlayPhase(page: Page): Promise<void> {
    await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-board-run-status', 'playing', {
        timeout: 60_000
    });
}

/** Menu + level 1 play without onboarding or powers FTUE chrome (used by gesture/layout harnesses). */
export const defaultE2eGameSaveJson = JSON.stringify({
    schemaVersion: SAVE_SCHEMA_VERSION,
    bestScore: 0,
    achievements: {
        ACH_FIRST_CLEAR: false,
        ACH_LEVEL_FIVE: false,
        ACH_SCORE_THOUSAND: false,
        ACH_PERFECT_CLEAR: false,
        ACH_LAST_LIFE: false
    },
    settings: {
        masterVolume: 0.8,
        musicVolume: 0.55,
        sfxVolume: 0.8,
        displayMode: 'windowed',
        uiScale: 1,
        reduceMotion: true,
        debugFlags: {
            showDebugTools: false,
            allowBoardReveal: false,
            disableAchievementsOnDebug: true
        }
    },
    onboardingDismissed: true,
    lastRunSummary: null,
    powersFtueSeen: true
});

/** Clone default E2E save with a specific board renderer tier (card overlay draw path). */
export const e2eSaveWithGraphicsQuality = (graphicsQuality: GraphicsQualityPreset): string => {
    const parsed: unknown = JSON.parse(defaultE2eGameSaveJson);
    if (typeof parsed !== 'object' || parsed === null || !('settings' in parsed)) {
        return defaultE2eGameSaveJson;
    }
    const next = { ...parsed, settings: { ...(parsed as { settings: object }).settings, graphicsQuality } };
    return JSON.stringify(next);
};

export async function navigateToLevel1PlayPhase(
    page: Page,
    saveJson: string = defaultE2eGameSaveJson
): Promise<MemorizePairPositions | null> {
    await page.addInitScript(
        ([key, json]) => {
            localStorage.setItem(key, json);
        },
        [STORAGE_KEY, saveJson]
    );
    await page.goto('/');
    await dismissStartupIntro(page);
    let openedViaFixture = false;
    try {
        await expect(async () => {
            const playButton = page.getByRole('button', { name: /^play$/i });
            await expect(playButton).toBeVisible({ timeout: 5_000 });
            await playButton.evaluate((el) => (el as HTMLButtonElement).click());
            await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible({ timeout: 5_000 });
        }).toPass({ timeout: 12_000 });
        await expect(async () => {
            if (await page.getByTestId('game-hud').isVisible().catch(() => false)) {
                return;
            }
            const startRunButton = page.getByRole('button', { name: /start run/i });
            await expect(startRunButton).toBeVisible({ timeout: 5_000 });
            await startRunButton.evaluate((el) => (el as HTMLButtonElement).click());
            await expect(page.getByRole('heading', { name: /level \d+/i })).toBeAttached({ timeout: 5_000 });
        }).toPass({ timeout: 12_000 });
    } catch {
        await page.evaluate(async () => {
            const w = window as Window & {
                __memoryDungeonE2e?: {
                    startFixture?: (id: 'activeRunWithHazards') => Promise<void>;
                };
            };
            if (!w.__memoryDungeonE2e?.startFixture) {
                throw new Error('window.__memoryDungeonE2e.startFixture missing; cannot open fallback gameplay fixture.');
            }
            await w.__memoryDungeonE2e.startFixture('activeRunWithHazards');
        });
        openedViaFixture = true;
    }
    // Level title can be sr-only on compact viewports; attached is enough to proceed.
    await expect(page.getByRole('heading', { name: /level \d+/i })).toBeAttached({ timeout: 15_000 });
    await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 15_000 });
    await expect
        .poll(async () => readFrameHiddenTileCount(page), {
            timeout: 50_000,
            intervals: [80, 120, 200, 400]
        })
        .toBeGreaterThan(0);
    await expect(page.getByTestId('tile-board-application')).toBeVisible({ timeout: 25_000 });

    /** Capture memorize-phase pair map before `waitForBoardPlayPhase` — afterward aria labels are hidden-tile text. */
    let memorizePairs: MemorizePairPositions | null = null;
    if (openedViaFixture) {
        await waitForBoardPlayPhase(page);
        return null;
    }
    const captureDeadline = Date.now() + 45_000;
    while (Date.now() < captureDeadline) {
        const status = await page.getByTestId('tile-board-frame').getAttribute('data-board-run-status');
        const snap = await readMemorizeSnapshot(page);
        if (snap) {
            memorizePairs = snap;
            break;
        }
        if (status === 'playing') {
            break;
        }
        await page.waitForTimeout(20);
    }

    await waitForBoardPlayPhase(page);
    if (!memorizePairs) {
        memorizePairs = await readDevPairPositionsFromFrame(page);
    }
    return memorizePairs;
}

/**
 * Flip the tile at (row, column) (1-based, matching memorize / `Hidden tile, row R, column C`).
 * Under WebGL, arrow-key roving skips removed tiles, so “N× ArrowRight” is not the same as column N after a match.
 * Playwright runs against Vite dev — we call `window.__e2ePickTileAtGrid1` (see `TileBoard.tsx`) for stable grid picks.
 */
export async function flipTileAtGridCellKeyboard(page: Page, row: number, column: number): Promise<void> {
    await page.evaluate(
        ([r, c]) => {
            const w = window as Window & { __e2ePickTileAtGrid1?: (row: number, col: number) => void };
            const pick = w.__e2ePickTileAtGrid1;
            if (!pick) {
                throw new Error(
                    'window.__e2ePickTileAtGrid1 missing — e2e expects Vite dev (import.meta.env.DEV) so TileBoard registers the hook.'
                );
            }
            pick(r, c);
        },
        [row, column] as const
    );
}

/**
 * Read the current screen-space bounds of a tile at (row, column) from the live WebGL board.
 * Requires Vite dev so `TileBoard` registers `window.__e2eGetTileClientRectAtGrid1`.
 */
export async function readTileClientRectAtGrid(page: Page, row: number, column: number): Promise<E2eClientRect> {
    return page.evaluate(
        ([r, c]) => {
            const w = window as Window & {
                __e2eGetTileClientRectAtGrid1?: (row: number, col: number) => {
                    bottom: number;
                    height: number;
                    left: number;
                    right: number;
                    top: number;
                    width: number;
                } | null;
            };
            const getRect = w.__e2eGetTileClientRectAtGrid1;
            if (!getRect) {
                throw new Error(
                    'window.__e2eGetTileClientRectAtGrid1 missing — e2e expects Vite dev so TileBoard registers the hook.'
                );
            }
            const rect = getRect(r, c);
            if (!rect) {
                throw new Error(`No tile client rect for row ${r}, col ${c}.`);
            }
            return rect;
        },
        [row, column] as const
    );
}

/**
 * Select a hidden tile at (row, column) and wait for the board to register a flip.
 */
export async function clickHiddenTileRowCol(page: Page, row: number, column: number, hiddenBefore?: number): Promise<void> {
    await flipTileAtGridCellKeyboard(page, row, column);
    if (hiddenBefore != null) {
        await expect
            .poll(async () => readFrameHiddenTileCount(page), { timeout: 12_000 })
            .not.toBe(hiddenBefore);
    }
}

/** @deprecated Alias for `flipTileAtGridCellKeyboard` — kept for specs that still say “click canvas”. */
export async function clickCanvasTile(page: Page, row: number, column: number): Promise<void> {
    await flipTileAtGridCellKeyboard(page, row, column);
}

/**
 * Opens the in-run settings modal the way a player does.
 *
 * The run dock used to carry a "Run settings (toolbar)" button, and nine places in the e2e suite
 * still drove it long after the run-shell rebuild removed it. Settings is reached through the pause
 * menu now — Pause, then Settings — so the route lives here once rather than being retyped at every
 * call site for the next rebuild to break again.
 */
export async function openRunSettings(page: Page): Promise<void> {
    const pauseOverlay = page.getByTestId('game-pause-overlay');
    if (!(await pauseOverlay.isVisible().catch(() => false))) {
        await page.getByTestId('game-toolbar-main-menu').click({ force: true });
        await expect(pauseOverlay).toBeVisible();
    }
    await pauseOverlay.getByRole('button', { name: /^settings$/i }).click({ force: true });
    await expect(page.getByRole('dialog', { name: /run settings/i })).toBeVisible();
}
