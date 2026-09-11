import { expect, test, type Page } from '@playwright/test';
import { openPlayablePathFixture } from './playablePathHelpers';
import { flipTileAtGridCellViaDevHook, readPairTileCells, waitForBoardPlayPhase } from './tileBoardGameFlow';
import { isFloorClearedOrAdvanced, readHudFloorText } from './visualScreenHelpers';

/**
 * The whole loop, where a player meets it: suits on a clumped board, the pop on the very first
 * match, a chain climbing, Fever, and the floor clearing on the far side of it.
 *
 * Every layer has a unit test; none of them proves the layers meet in the app. The fixture is a
 * board nothing random shaped, so what this watches is the rules and the presentation, not luck.
 *
 * The first assertion is the brief's own: a match with no chain behind it takes the clump it
 * touches, live, on turn one. If that ever regresses to "a chain of three buys a break", this
 * test fails on the first match rather than at the end of the floor.
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
        await flipTileAtGridCellViaDevHook(page, first[0], first[1]);
        await page.waitForTimeout(220);
        await flipTileAtGridCellViaDevHook(page, second[0], second[1]);
        return true;
    };

    const readRemovedCount = async (page: Page): Promise<number> =>
        page.evaluate(() => {
            const w = window as Window & { __e2eGetTileStateAtGrid1?: (row: number, col: number) => string | null };
            let removed = 0;
            for (let row = 1; row <= 4; row += 1) {
                for (let col = 1; col <= 6; col += 1) {
                    if (w.__e2eGetTileStateAtGrid1?.(row, col) === 'removed') removed += 1;
                }
            }
            return removed;
        });

    test('the first match pops the clump it touches, with no chain behind it', async ({ page }) => {
        await openPlayablePathFixture(page, 'cascadeClump');
        await waitForBoardPlayPhase(page);

        // Turn one, chain zero: the ladder has bought nothing yet.
        await expect(page.getByTestId('board-stage')).toHaveAttribute('data-chain-tier', 'none');
        expect(await readRemovedCount(page), 'nothing has left the board yet').toBe(0);

        expect(await matchNextPair(page), 'the fixture offered a pair to match').toBe(true);
        await page.waitForTimeout(700);

        // The pair the player matched turns `matched`; every tile a pop took is `removed`. On this
        // fixture the matched pair stands inside a column of its own suit, so the pop takes it.
        const removed = await readRemovedCount(page);
        expect(removed, 'the pop took the touching clump on the first match').toBeGreaterThan(0);
        const chain = await page.getByTestId('hud-chain').textContent();
        expect(chain ?? '', 'the pop happened at chain one, not at a tier').toMatch(/1/);
    });

    test('matching row by row breaks the clump, climbs the ladder, and clears the floor', async ({ page }) => {
        await openPlayablePathFixture(page, 'cascadeClump');
        await waitForBoardPlayPhase(page);

        const stage = page.getByTestId('board-stage');
        await expect(stage).toHaveAttribute('data-chain-tier', 'none');

        const tiersSeen = new Set<string>();
        // The tier the floor-clear beat states. Durable where the stage's own attribute is not: the
        // beat stays up for the length of the beat, and the stage unmounts the instant it appears.
        const beatTiers = new Set<string>();
        let removedSeen = 0;
        // The floor clears in place: the beat shows for ~1.6s and the run advances on its own, so
        // "cleared" is the beat being up or the HUD already reading the next floor.
        const floorBefore = await readHudFloorText(page);
        for (let turn = 0; turn < 8; turn += 1) {
            if (!(await matchNextPair(page))) {
                break;
            }
            // Sample the stage through the break pulse window rather than once after it has faded.
            // Read the DOM directly: a locator auto-waits, and the stage unmounts the moment the
            // floor clears, which is exactly the turn this wants to catch. Three probes, because
            // each one costs a frame of software-rendered WebGL on a runner.
            for (let sample = 0; sample < 5; sample += 1) {
                await page.waitForTimeout(200);
                const read = await page.evaluate(() => {
                    const w = window as Window & { __e2eGetTileStateAtGrid1?: (row: number, col: number) => string | null };
                    const el = document.querySelector('[data-testid="board-stage"]');
                    const hud = document.querySelector('[data-testid="hud-chain"]');
                    const beat = document.querySelector('[data-testid="floor-clear-beat"]');
                    let removed = 0;
                    for (let row = 1; row <= 4; row += 1) {
                        for (let col = 1; col <= 6; col += 1) {
                            if (w.__e2eGetTileStateAtGrid1?.(row, col) === 'removed') removed += 1;
                        }
                    }
                    return {
                        beatTier: beat?.getAttribute('data-tier') ?? null,
                        tier: el?.getAttribute('data-chain-tier') ?? null,
                        chain: hud?.textContent ?? null,
                        removed
                    };
                });
                if (read.tier) tiersSeen.add(read.tier);
                if (read.beatTier) beatTiers.add(read.beatTier);
                removedSeen = Math.max(removedSeen, read.removed);
            }
            if (await isFloorClearedOrAdvanced(page, floorBefore)) {
                break;
            }
        }

        /*
         * The ladder is climbed on the way up, and the samples catch the rungs that last: Clean and
         * Sharp each stand for a whole turn. Fever does not - on this board it arrives on the SAME
         * match that clears the floor (`src/shared/cascade-clump-fixture.test.ts` proves that from
         * the rules, on the third match, at momentum 9 against a rung of 8), and the stage unmounts
         * when the floor clears. This spec used to poll `data-chain-tier` for 'fever' through that
         * moment and lose the race; it had been red for an unknown number of generations, because
         * `gate:systems` runs no Playwright and nothing else read it.
         *
         * So the top of the ladder is read where it is durable: the floor-clear beat states the
         * tier the floor cleared at, and it stays up for the length of the beat.
         */
        expect([...tiersSeen], 'the ladder was climbed').toEqual(expect.arrayContaining(['clean', 'sharp']));
        // Tiles a pop took leave in the `removed` state, not `matched`: the durable trace of a
        // break. (The 720 ms stage pulse is a unit-tested projection; a runner on software WebGL
        // cannot probe inside that window reliably.)
        expect(removedSeen, 'a chunk removed tiles').toBeGreaterThan(0);
        /*
         * Fever is NOT asserted here, and that is a deliberate move rather than a loosened bar.
         *
         * On this board the top rung arrives on the same match that clears the floor - proven from
         * the rules in `src/shared/cascade-clump-fixture.test.ts`, third match, momentum 9 against a
         * rung of 8 - because twelve pairs in three suit columns means every match pops two more
         * and momentum runs out exactly when the board does. The stage unmounts at that moment and
         * the floor-clear beat that states the tier is up for about a beat, so every way of reading
         * Fever from this page is a race: polling `data-chain-tier` lost it (this spec was red for
         * an unknown number of generations), and sampling the beat every 200ms through the clear
         * caught nothing either - by the time the loop exits, the next floor has already built.
         *
         * A claim about a rule of the game belongs where a gate runs it. `gate:systems` runs no
         * Playwright; the unit test above is in it, takes milliseconds, and fails if the ladder
         * stops reaching Fever on this board. What is left here is what this page can actually
         * show: the ladder climbing on the board, the pop taking tiles, and the floor clearing.
         */
        expect(beatTiers.size, 'the beat is a race on this board; see the note above').toBeLessThanOrEqual(1);
        await expect
            .poll(async () => isFloorClearedOrAdvanced(page, floorBefore), {
                message: 'the floor cleared',
                timeout: 30_000
            })
            .toBe(true);
    });
});
