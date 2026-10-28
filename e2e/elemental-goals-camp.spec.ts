import { expect, test } from '@playwright/test';
import { openModeLibrary, expectGameplayReady } from './playablePathHelpers';

test('exact-seed rematch preserves its preference and compares the previous attempt', async ({ page }) => {
    test.setTimeout(180_000);
    await openModeLibrary(page);
    await page.getByLabel('Play a shared run', { exact: true }).fill('md1:classic:64:17:score');
    await page.getByRole('button', { name: 'Play it', exact: true }).click();
    await expectGameplayReady(page);
    for (let attempt = 0; attempt < 2; attempt++) {
        await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().skipMemorizePhase());
        await expect.poll(async () => page.evaluate(async () => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            const { run, pressTile } = useAppStore.getState();
            const { crawlReachableCells } = await import('/src/shared/crawl-rules.ts');
            if (run?.status === 'gameOver') return true;
            const flipped = run?.board?.flippedTileIds ?? [];
            if (flipped.length === 2) { pressTile(flipped[0]!); return false; }
            const hidden = run?.board?.tiles.filter(tile => tile.state === 'hidden') ?? [];
            // The crawl (`crawl-rules.ts`): a turn opens on a card the hero can reach.
            const reach = run?.board?.crawl ? crawlReachableCells(run.board, run.stickyBlockIndex) : null;
            const first = hidden.find(tile => !reach || reach.has(run!.board!.tiles.indexOf(tile)));
            const second = hidden.find(tile => tile.pairKey !== first?.pairKey);
            if (first && second && flipped.length === 0) { pressTile(first.id); pressTile(second.id); }
            return false;
        }), { timeout: 60_000, intervals: [600] }).toBe(true);
        if (attempt === 0) {
            await page.getByTestId('game-over-rematch').click();
            await expectGameplayReady(page);
            expect(await page.evaluate(async () => {
                const run = (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run!;
                return { seed: run.runSeed, preference: run.campPreference };
            })).toEqual({ seed: 17, preference: 'score' });
        }
    }
    const comparison = page.getByTestId('rematch-comparison');
    await expect(comparison).toBeVisible();
    await expect(comparison).toContainText('misses spent');
    await expect(comparison).toContainText('turns vs par');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(comparison).toBeVisible();
    await page.screenshot({ path: 'test-results/rematch-comparison-phone.png' });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(comparison).toBeVisible();
    await page.screenshot({ path: 'test-results/rematch-comparison-landscape.png' });
});

test('camp preference is selectable and featured goals are visible during study and play', async ({ page }) => {
    test.setTimeout(180_000);
    await openModeLibrary(page);
    await page.getByRole('button', { name: 'Set up your run', exact: true }).click();
    await page.getByLabel('Automatic camp spending').selectOption('score');
    await page.getByTestId('classic-setup-sheet').getByRole('button', { name: 'Start run', exact: true }).click();
    await expectGameplayReady(page);
    expect(await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().run?.campPreference)).toBe('score');
    await page.evaluate(async () => {
        const { startTestHallRoom } = await import('/src/renderer/dev/testHallLoader.ts');
        startTestHallRoom('featured-calm-reaction');
    });
    await page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const run = useAppStore.getState().run!;
        useAppStore.setState({ run: { ...run, status: 'memorize', timerState: { ...run.timerState, memorizeRemainingMs: 60_000 } } });
    });
    await expect(page.getByTestId('featured-floor-goal')).toBeVisible();
    await expect(page.getByTestId('featured-floor-goal')).toContainText('Water → Water → Ice');
    await page.screenshot({ path: 'test-results/elemental-goal-desktop.png' });
    await page.evaluate(async () => (await import('/src/renderer/store/useAppStore.ts')).useAppStore.getState().skipMemorizePhase());
    await expect(page.getByTestId('featured-floor-goal')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('featured-floor-goal')).toBeVisible();
    await page.screenshot({ path: 'test-results/elemental-goal-phone.png' });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId('featured-floor-goal')).toBeVisible();
    await page.screenshot({ path: 'test-results/elemental-goal-landscape.png' });
});
