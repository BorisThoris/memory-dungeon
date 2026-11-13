import { expect, test, type Page } from '@playwright/test';
import { dismissStartupIntro } from './startupIntroHelpers';
import { mainMenuPlayButton, openLevel1Play, waitLevel1PlayReady } from './visualScreenHelpers';

/**
 * A run put down and picked up again (`src/renderer/store/suspendedRun.ts`): closing the game
 * mid-floor and opening it again offers the run back on the menu, paused on the same board, and
 * it plays on from there. A retreat ends it, and the menu offers Play again.
 */
const runSnapshot = (page: Page): Promise<{ seed: number; floor: number; status: string; tiles: number } | null> =>
    page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const run = useAppStore.getState().run;
        return run ? { seed: run.runSeed, floor: run.board?.level ?? 0, status: run.status, tiles: run.board?.tiles.length ?? 0 } : null;
    });

/** The startup intro, skipped, with a run waiting: the menu leads with Continue, not Play. */
const skipIntroToContinue = async (page: Page): Promise<void> => {
    const intro = page.getByRole('dialog', { name: /startup relic intro/i });
    await expect
        .poll(
            async () => {
                if (await intro.isVisible().catch(() => false)) await intro.press('Escape', { timeout: 2_000 }).catch(() => {});
                return page.getByRole('button', { name: 'Continue', exact: true }).isVisible().catch(() => false);
            },
            { timeout: 90_000, intervals: [100, 300, 500, 1_000] }
        )
        .toBe(true);
    await expect(page.locator('[data-e2e-menu-pointer="interactive"]')).toBeAttached({ timeout: 25_000 });
};

test.describe('a run put down and picked up again', () => {
    test.describe.configure({ timeout: 300_000 });

    test('closing mid-floor and coming back continues the same run, paused', async ({ page }) => {
        await openLevel1Play(page);
        await waitLevel1PlayReady(page);
        const before = await runSnapshot(page);
        expect(before?.status).toBe('playing');

        // The tab is closed and opened again: the store starts empty, the snapshot is on disk.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
        await skipIntroToContinue(page);
        const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
        await expect(continueButton).toContainText(`Floor ${before!.floor}`);
        await expect(mainMenuPlayButton(page)).toHaveCount(0);

        await continueButton.click();
        await expect(page.getByTestId('game-hud')).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible({ timeout: 30_000 });
        const restored = await runSnapshot(page);
        expect(restored).toMatchObject({ seed: before!.seed, floor: before!.floor, status: 'paused', tiles: before!.tiles });

        await page.getByRole('button', { name: 'Resume', exact: true }).click();
        await expect.poll(async () => (await runSnapshot(page))?.status, { timeout: 30_000 }).toBe('playing');
        await expect(page.getByTestId('tile-board-frame')).toHaveAttribute('data-board-run-status', 'playing');

        // A retreat ends the run: nothing is left to continue.
        await page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            useAppStore.getState().endRun();
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 180_000 });
        await dismissStartupIntro(page);
        await expect(mainMenuPlayButton(page)).toBeVisible({ timeout: 60_000 });
        await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    });
});
