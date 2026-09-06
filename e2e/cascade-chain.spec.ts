import { expect, test, type Page } from '@playwright/test';
import { openPlayablePathFixture } from './playablePathHelpers';
import { flipTileAtGridCellKeyboard, readPairTileCells, waitForBoardPlayPhase } from './tileBoardGameFlow';

/**
 * The whole loop, where a player meets it: suits on a clumped board, a chain climbing, a chunk
 * breaking with a visible pulse, Fever, and the floor clearing on the far side of it.
 *
 * Every layer has a unit test; none of them proves the layers meet in the app. The fixture is a
 * board nothing random shaped, so what this watches is the rules and the presentation, not luck.
 */
test.describe('chain, chunk and Fever in the app', () => {
    // Software WebGL on a runner makes every probe cost about a second; the budget is for that, not for slack.
    test.describe.configure({ retries: 0, timeout: 300_000 });

    const matchNextPair = async (page: Page): Promise<boolean> => {
        const byPair = new Map<string, [number, number][]>();
        for (const tile of await readPairTileCells(page)) {
            byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), tile.cell]);
        }
        const pair = [...byPair.values()].find((cells) => cells.length >= 2);
        if (!pair) {
            return false;
        }
        const [first, second] = pair as [[number, number], [number, number]];
        await flipTileAtGridCellKeyboard(page, first[0], first[1]);
        await page.waitForTimeout(220);
        await flipTileAtGridCellKeyboard(page, second[0], second[1]);
        return true;
    };

    test('matching row by row breaks the clump, reaches Fever, and clears the floor', async ({ page }) => {
        await openPlayablePathFixture(page, 'cascadeClump');
        await waitForBoardPlayPhase(page);

        const stage = page.getByTestId('board-stage');
        await expect(stage).toHaveAttribute('data-chain-tier', 'none');

        const tiersSeen = new Set<string>();
        const chainTexts: string[] = [];
        let removedSeen = 0;
        let removedAtFever = 0;
        for (let turn = 0; turn < 8; turn += 1) {
            if (!(await matchNextPair(page))) {
                break;
            }
            // Sample the stage through the break pulse window rather than once after it has faded.
            // Read the DOM directly: a locator auto-waits, and the stage unmounts the moment the
            // floor clears, which is exactly the turn this wants to catch. Three probes, because
            // each one costs a frame of software-rendered WebGL on a runner.
            for (let sample = 0; sample < 3; sample += 1) {
                await page.waitForTimeout(200);
                const read = await page.evaluate(() => {
                    const w = window as Window & { __e2eGetTileStateAtGrid1?: (row: number, col: number) => string | null };
                    const el = document.querySelector('[data-testid="board-stage"]');
                    const hud = document.querySelector('[data-testid="hud-chain"]');
                    let removed = 0;
                    for (let row = 1; row <= 4; row += 1) {
                        for (let col = 1; col <= 6; col += 1) {
                            if (w.__e2eGetTileStateAtGrid1?.(row, col) === 'removed') removed += 1;
                        }
                    }
                    return {
                        tier: el?.getAttribute('data-chain-tier') ?? null,
                        chain: hud?.textContent ?? null,
                        removed
                    };
                });
                if (read.tier) tiersSeen.add(read.tier);
                if (read.chain) chainTexts.push(read.chain);
                if (read.tier === 'fever' && read.removed > removedAtFever) removedAtFever = read.removed;
                removedSeen = Math.max(removedSeen, read.removed);
            }
            if (await page.getByRole('dialog', { name: /floor cleared/i }).isVisible().catch(() => false)) {
                break;
            }
        }

        // Clean lasts one match on this board — the first break lifts momentum straight to Sharp —
        // so what the samples must catch is the top of the ladder, not every rung on the way.
        expect([...tiersSeen], 'the ladder was climbed').toEqual(expect.arrayContaining(['sharp', 'fever']));
        // Tiles a chunk took leave in the `removed` state, not `matched`: the durable trace of a
        // break. (The 720 ms stage pulse is a unit-tested projection; a runner on software WebGL
        // cannot probe inside that window reliably.)
        expect(removedSeen, 'a chunk removed tiles').toBeGreaterThan(0);
        expect(removedAtFever, 'tiles were gone while the board read Fever').toBeGreaterThan(0);
        expect(chainTexts.some((text) => /Fever/.test(text)), 'the HUD named Fever').toBe(true);
        await expect(page.getByRole('dialog', { name: /floor cleared/i })).toBeVisible({ timeout: 30_000 });
    });
});
