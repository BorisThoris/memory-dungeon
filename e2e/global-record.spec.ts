import { expect, test } from '@playwright/test';
import { openMainMenuFromSave } from './visualScreenHelpers';
test.use({ deviceScaleFactor: 3 });

test('global record: qualify only above the record, moderate names, claim and fit phone screens', async ({ page }) => {
    test.setTimeout(180_000);
    let record = { name: 'Boris', score: 500, at: '2026-10-11T00:00:00Z' };
    await page.route('https://memory-dungeon-scores.modaxxx009.workers.dev/record', async route => {
        if (route.request().method() === 'POST') {
            const body = route.request().postDataJSON() as { name: string; score: number };
            record = { ...record, ...body };
            await route.fulfill({ json: { accepted: true, record } });
        } else await route.fulfill({ json: { record } });
    });
    await openMainMenuFromSave(page, true);
    await expect(page.getByLabel('Global high score')).toContainText('Dungeon Master · Boris · 500');
    const endRun = async (score: number) => page.evaluate(async value => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const { createNewRun, createRunSummary, finishMemorizePhase } = await import('/src/shared/game-core.ts');
        let run = finishMemorizePhase(createNewRun(100, { runSeed: value }));
        run = createRunSummary({ ...run, status: 'gameOver', stats: { ...run.stats, totalScore: value } }, []);
        useAppStore.setState({ run, view: 'gameOver', runStartSaveData: useAppStore.getState().saveData });
    }, score);
    await endRun(500);
    await expect(page.getByTestId('run-end-cinematic-record')).toBeVisible();
    await expect(page.getByTestId('global-record-dialog')).toHaveCount(0);
    await endRun(600);
    const dialog = page.getByTestId('global-record-dialog');
    await expect(dialog).toBeVisible();
    for (const [width, height] of [[1280, 720], [390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        const box = await dialog.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
        await expect(dialog.getByRole('button', { name: 'Claim global record' })).toBeVisible();
        const actionBox = await dialog.getByRole('button', { name: 'Claim global record' }).boundingBox();
        expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(height + 1);
        await page.screenshot({ path: `test-results/global-record-${width}x${height}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Your name').fill('s.h.1.t');
    await page.getByRole('button', { name: 'Claim global record' }).click();
    await expect(page.getByRole('alert')).toHaveText('That name is not going on the board');
    await page.getByLabel('Your name').fill('Nick Gera');
    await page.getByRole('button', { name: 'Claim global record' }).click();
    await expect(page.getByRole('alert')).toHaveText('That name is not going on the board');
    await page.getByLabel('Your name').fill('Ada');
    await page.getByRole('button', { name: 'Claim global record' }).click();
    await expect(page.getByRole('heading', { name: 'The global record is yours' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(dialog).toHaveCount(0);
});
