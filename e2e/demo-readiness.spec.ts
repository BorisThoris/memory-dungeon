import { expect, test, type Page } from '@playwright/test';

const blockingConsoleTypes = new Set(['error']);

function installBlockingErrorChecks(page: Page) {
    const blockingErrors: string[] = [];

    page.on('console', (message) => {
        if (!blockingConsoleTypes.has(message.type())) {
            return;
        }

        blockingErrors.push(message.text());
    });

    page.on('pageerror', (error) => {
        blockingErrors.push(error.message);
    });

    return {
        expectClean() {
            expect(blockingErrors).toEqual([]);
        },
    };
}

async function installAudioHookAudit(page: Page) {
    await page.addInitScript(() => {
        const NativeAudio = window.Audio;
        const audit = {
            constructed: 0,
            playAttempts: 0,
            playFailures: 0,
        };

        Object.defineProperty(window, '__memoryDungeonAudioAudit', {
            configurable: true,
            value: audit,
        });

        window.Audio = function Audio(src?: string) {
            const el = new NativeAudio(src);
            audit.constructed += 1;
            const nativePlay = el.play.bind(el);
            el.play = () => {
                audit.playAttempts += 1;
                return nativePlay().catch((error) => {
                    audit.playFailures += 1;
                    throw error;
                });
            };
            return el;
        } as typeof Audio;
        window.Audio.prototype = NativeAudio.prototype;
    });
}

async function openFromCleanBrowserState(page: Page) {
    await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
    });

    await page.goto('/');
}

async function expectAudioHooksInitialized(page: Page) {
    const audit = await page.evaluate(() => {
        const w = window as Window & {
            __memoryDungeonAudioAudit?: {
                constructed: number;
                playAttempts: number;
                playFailures: number;
            };
        };
        return w.__memoryDungeonAudioAudit ?? null;
    });

    expect(audit?.constructed).toBeGreaterThan(0);
    expect(audit?.playAttempts).toBeGreaterThan(0);
}

async function expectMainMenu(page: Page) {
    await expect(page.getByRole('heading', { name: /memory dungeon/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /classic|featured|daily|gauntlet|puzzle|meditation/i }).first()).toBeVisible();
}

async function startPortfolioRun(page: Page) {
    const featuredRun = page.getByRole('button', { name: /featured|practice|scholar|wild|puzzle/i }).first();
    const classicRun = page.getByRole('button', { name: /classic/i }).first();
    const startRun = page.getByRole('button', { name: /start|begin|play/i }).first();

    if (await featuredRun.isVisible()) {
        await featuredRun.click();
    } else if (await classicRun.isVisible()) {
        await classicRun.click();
    } else {
        await startRun.click();
    }
}

async function expectInteractiveBoard(page: Page) {
    const board = page
        .getByRole('grid')
        .or(page.locator('[data-testid*="board" i]'))
        .or(page.locator('canvas'))
        .first();

    await expect(board).toBeVisible();

    const tile = page
        .getByRole('button', { name: /tile|card|hidden|memory|symbol/i })
        .or(page.locator('[data-testid*="tile" i], [data-testid*="card" i], button').filter({ hasNotText: /settings|menu|pause/i }))
        .first();

    await expect(tile).toBeVisible();
    await tile.click();
}

async function expectSettingsCanOpenAndClose(page: Page) {
    await page.getByRole('button', { name: /settings/i }).click();

    const settingsSurface = page
        .getByRole('dialog', { name: /settings/i })
        .or(page.getByRole('heading', { name: /settings/i }))
        .first();

    await expect(settingsSurface).toBeVisible();

    const closeSettings = page.getByRole('button', { name: /close|back|resume|done|settings/i }).first();
    await closeSettings.click();
    await expect(settingsSurface).toBeHidden();
}

test.describe('portfolio demo readiness', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('starts a clean desktop demo run and keeps the first board usable', async ({ page }) => {
        const errors = installBlockingErrorChecks(page);
        await installAudioHookAudit(page);

        await openFromCleanBrowserState(page);
        await expectMainMenu(page);
        await startPortfolioRun(page);
        await expectInteractiveBoard(page);
        await expectSettingsCanOpenAndClose(page);
        await expectAudioHooksInitialized(page);

        errors.expectClean();
    });

    test('keeps the first-run demo path available on mobile', async ({ page }) => {
        test.setTimeout(45_000);
        await page.setViewportSize({ width: 390, height: 844 });
        const errors = installBlockingErrorChecks(page);
        await installAudioHookAudit(page);

        await openFromCleanBrowserState(page);
        await expectMainMenu(page);
        await startPortfolioRun(page);
        await expectInteractiveBoard(page);
        await expectAudioHooksInitialized(page);

        errors.expectClean();
    });
});
