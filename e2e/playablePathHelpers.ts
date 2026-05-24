import { expect, type Locator, type Page } from '@playwright/test';
import {
    completeLevel1Play,
    forceGameOverWithMismatches,
    mainMenuPlayButton,
    openChooseYourPath,
    openLevel1Play,
    openMainMenuFromSave,
    buildVisualSaveJson,
    gotoWithSave,
    startClassicRunFromModeSelect,
    waitLevel1PlayReady
} from './visualScreenHelpers';
import { readDevPairPositionsFromFrame } from './memorizeSnapshot';
import { flipTileAtGridCellKeyboard, readFrameHiddenTileCount, waitForBoardPlayPhase } from './tileBoardGameFlow';
import { dismissStartupIntro } from './startupIntroHelpers';

export type PlayablePathFixtureId =
    | 'freshProfile'
    | 'activeRunWithHazards'
    | 'activeTrapRun'
    | 'floorClearWithRouteChoices'
    | 'floorClearWithShop'
    | 'floorClearWithShopLowGold'
    | 'sideRoomPrimary'
    | 'sideRoomChoice'
    | 'sideRoomSkip'
    | 'sideRoomThenShop'
    | 'relicDraft'
    | 'gameOver';

export async function expectGameplayReady(page: Page): Promise<void> {
    await expect(page.getByRole('group', { name: /run stats/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('tile-board-frame')).toBeVisible({ timeout: 30_000 });
}

export async function openModeLibrary(page: Page): Promise<void> {
    await openMainMenuFromSave(page, true);
    await openChooseYourPath(page);
    const library = page.getByRole('region', { name: /browse modes/i });
    if (!(await library.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /browse modes/i }).click();
    }
    await expect(library).toBeVisible();
}

export async function openModeDetail(page: Page, modeTitle: string): Promise<Locator> {
    if (!(await page.getByRole('region', { name: /choose your path/i }).isVisible().catch(() => false))) {
        const play = mainMenuPlayButton(page);
        if (await play.isVisible().catch(() => false)) {
            await play.click({ force: true });
            await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible({ timeout: 15_000 });
        }
    }
    let modeTile = page.getByRole('button', {
        name: new RegExp(`^${escapeRegExp(modeTitle)}\\. Open details\\.$`, 'i')
    });
    if ((await modeTile.count()) === 0 || !(await modeTile.first().isVisible().catch(() => false))) {
        const searchButton = page.getByRole('button', { name: /search modes|edit search filter/i });
        if ((await searchButton.count()) > 0) {
            await searchButton.first().click({ force: true });
            await page.getByLabel(/filter modes/i).fill(modeTitle);
            modeTile = page.getByRole('button', {
                name: new RegExp(`^${escapeRegExp(modeTitle)}\\. Open details\\.$`, 'i')
            });
        }
    }
    await modeTile.scrollIntoViewIfNeeded();
    await modeTile.click({ force: true });
    const modal = page.getByTestId('library-mode-detail-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByRole('heading', { name: new RegExp(`^${escapeRegExp(modeTitle)}$`, 'i') })).toBeVisible();
    return modal;
}

export async function startModeFromLibrary(page: Page, modeTitle: string): Promise<void> {
    const modal = await openModeDetail(page, modeTitle);
    await modal.getByRole('button', { name: /^play$/i }).click();
    await expectGameplayReady(page);
}

export async function startGauntletFromLibrary(page: Page, presetLabel = '5m'): Promise<void> {
    const modal = await openModeDetail(page, 'Gauntlet');
    await modal.getByRole('button', { name: new RegExp(`^${escapeRegExp(presetLabel)}$`, 'i') }).click();
    await expectGameplayReady(page);
}

export async function startMeditationWithSelection(page: Page): Promise<void> {
    const modal = await openModeDetail(page, 'Meditation');
    await modal.getByRole('button', { name: /set up run/i }).click();
    const setup = page.getByRole('dialog', { name: /meditation setup/i });
    await expect(setup).toBeVisible();
    const firstCheckbox = setup.getByRole('checkbox').first();
    if ((await firstCheckbox.count()) > 0) {
        await firstCheckbox.check({ force: true });
    }
    await setup.getByRole('button', { name: /start with selection/i }).click();
    await expectGameplayReady(page);
}

export async function completeClassicLevelOne(page: Page): Promise<void> {
    await openLevel1Play(page);
    const pairs = await waitLevel1PlayReady(page);
    await completeLevel1Play(page, pairs);
    await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible({ timeout: 30_000 });
}

export async function forceClassicGameOver(page: Page): Promise<void> {
    await openLevel1Play(page);
    const pairs = await waitLevel1PlayReady(page);
    const usablePairs = pairs && Object.keys(pairs).length >= 2 ? pairs : await readDevPairPositionsFromFrame(page);
    if (usablePairs && Object.keys(usablePairs).length >= 2) {
        const keys = Object.keys(usablePairs);
        const a = usablePairs[keys[0]]![0]!;
        const b = usablePairs[keys[1]]![0]!;
        for (let i = 0; i < 12; i += 1) {
            if (await page.getByText(/Expedition Over/i).isVisible().catch(() => false)) {
                break;
            }
            await waitForBoardPlayPhase(page);
            await expect
                .poll(async () => readFrameHiddenTileCount(page), { timeout: 20_000 })
                .toBeGreaterThanOrEqual(2);
            await flipTileAtGridCellKeyboard(page, a.row, a.col);
            await flipTileAtGridCellKeyboard(page, b.row, b.col);
            await expect
                .poll(
                    async () => {
                        if (await page.getByText(/Expedition Over/i).isVisible().catch(() => false)) {
                            return 'over';
                        }
                        const hidden = await readFrameHiddenTileCount(page);
                        return hidden >= 2 ? 'ready' : 'settling';
                    },
                    { timeout: 25_000 }
                )
                .toMatch(/^(over|ready)$/);
        }
    } else {
        await forceGameOverWithMismatches(page, pairs);
    }
    await expect(page.getByText(/Expedition Over/i)).toBeVisible({ timeout: 30_000 });
}

export async function forceGameOverViaE2eHook(page: Page): Promise<void> {
    await gotoWithSave(page, buildVisualSaveJson(true));
    await dismissStartupIntro(page);
    await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => {
        const w = window as Window & { __memoryDungeonE2e?: { startClassicGameOver: () => void } };
        if (!w.__memoryDungeonE2e) {
            throw new Error('window.__memoryDungeonE2e missing; post-run E2E helper requires Vite dev mode.');
        }
        w.__memoryDungeonE2e.startClassicGameOver();
    });
    await expect(page.getByText(/Expedition Over/i)).toBeVisible({ timeout: 30_000 });
}

export async function forceCurrentRunGameOverViaE2eHook(page: Page): Promise<void> {
    await page.evaluate(() => {
        const w = window as Window & { __memoryDungeonE2e?: { forceGameOver: () => void } };
        if (!w.__memoryDungeonE2e) {
            throw new Error('window.__memoryDungeonE2e missing; current-run E2E helper requires Vite dev mode.');
        }
        w.__memoryDungeonE2e.forceGameOver();
    });
    await expect(page.getByText(/Expedition Over/i)).toBeVisible({ timeout: 30_000 });
}

export async function openPlayablePathFixture(page: Page, id: PlayablePathFixtureId): Promise<void> {
    await gotoWithSave(page, buildVisualSaveJson(true));
    await dismissStartupIntro(page);
    await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 30_000 });
    await expect
        .poll(
            async () =>
                page.evaluate(() => {
                    const w = window as Window & { __memoryDungeonE2e?: { startFixture?: unknown } };
                    return typeof w.__memoryDungeonE2e?.startFixture === 'function';
                }),
            { timeout: 30_000 }
        )
        .toBe(true);
    await page.evaluate(async (fixtureId) => {
        const w = window as Window & {
            __memoryDungeonE2e?: {
                startFixture?: (id: PlayablePathFixtureId) => Promise<void>;
            };
        };
        if (!w.__memoryDungeonE2e?.startFixture) {
            throw new Error('window.__memoryDungeonE2e.startFixture missing; playable-path fixtures require Vite dev mode.');
        }
        await w.__memoryDungeonE2e.startFixture(fixtureId);
    }, id);

    if (id === 'gameOver') {
        await expect(page.getByText(/Expedition Over/i)).toBeVisible({ timeout: 30_000 });
        return;
    }
    if (id.startsWith('sideRoom')) {
        await expect(page.getByTestId('side-room-screen')).toBeVisible({ timeout: 30_000 });
        return;
    }
    if (id === 'freshProfile') {
        await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 30_000 });
        return;
    }
    if (id === 'relicDraft') {
        await expect(page.getByTestId('game-relic-offer-overlay')).toBeVisible({ timeout: 30_000 });
        return;
    }
    await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 30_000 });
}

export async function startClassicFromMenu(page: Page): Promise<void> {
    await openMainMenuFromSave(page, true);
    await mainMenuPlayButton(page).click({ force: true });
    await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible();
    await startClassicRunFromModeSelect(page);
    await expectGameplayReady(page);
}

export async function closeVisibleModalByButton(page: Page, buttonName: RegExp): Promise<void> {
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: buttonName }) }).first();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: buttonName }).click();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
