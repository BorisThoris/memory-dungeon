import { expect, test, type Page } from '@playwright/test';
import { clickHiddenTileRowCol, readFrameHiddenTileCount, waitForBoardPlayPhase } from './tileBoardGameFlow';
import { openRunMenuItem } from './playablePathHelpers';
import { dismissStartupIntro } from './startupIntroHelpers';
import { mainMenuPlayButton } from './visualScreenHelpers';

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

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissStartupIntro(page);
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
    await expect(page.locator('h1').filter({ hasText: /memory dungeon/i })).toBeVisible();
    await expect(mainMenuPlayButton(page)).toBeVisible();
}

async function startPortfolioRun(page: Page) {
    await mainMenuPlayButton(page).click();
    await expect(page.getByRole('region', { name: /choose your path/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^start run$/i }).click();
}

async function expectInteractiveBoard(page: Page) {
    const board = page
        .getByRole('grid')
        .or(page.locator('[data-testid*="board" i]'))
        .or(page.locator('canvas'))
        .first();

    await expect(board).toBeVisible();
    await waitForBoardPlayPhase(page);
    const hiddenBefore = await readFrameHiddenTileCount(page);
    expect(hiddenBefore).toBeGreaterThan(0);
    await clickHiddenTileRowCol(page, 1, 1, hiddenBefore);
}

/*
 * Settings during a run is reached through the run menu, not a top-level button. This looked for
 * the menu's own Settings entry, which is not on screen once a run has started, and timed out —
 * a rot nothing caught because no routine gate ran this spec.
 */
async function expectSettingsCanOpenAndClose(page: Page) {
    await openRunMenuItem(page, 'settings');

    const settingsSurface = page.getByTestId('settings-shell-panel');
    await expect(settingsSurface).toBeVisible({ timeout: 20_000 });

    await settingsSurface.getByRole('button', { name: /^back$/i }).click({ force: true });
    await expect(settingsSurface).toBeHidden({ timeout: 20_000 });
}

test.describe('portfolio demo readiness', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('starts a clean desktop demo run and keeps the first board usable', async ({ page }) => {
        /*
         * Six times the median rather than two. Both tests together run in 45-55s here, and the
         * one failure in thirteen runs was a bare timeout with no pending action — this machine's
         * browser tests occasionally take several times their usual, which timed out the board
         * reachability test at 240s and the game-over fit test at 420s the same way. A budget that
         * tight reports as a failure with nothing to say about the product.
         */
        test.setTimeout(300_000);
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
        // Was 45s — less headroom than the desktop pass it follows, on a first-run path that
        // takes 20-25s of that by itself. Same budget as above.
        test.setTimeout(300_000);
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
