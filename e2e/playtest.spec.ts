import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { startClassicFromMenu } from './playablePathHelpers';

/**
 * The playtest (`yarn test:e2e:playtest`): a whole run, played from the main menu the way a player
 * plays it, with screenshots of every floor transition in `test-results/playtest/` for a human to
 * look over afterwards.
 *
 * The unit suite proves the rules and the soak proves the invariants; neither ever sees the screen
 * a run ends on. The first time this ran, it found the results screen never saying why a run was
 * over (the save round-trip dropped the reason), a chain line that read as the wrong multiplier and
 * a sentence opening in lower case - three bugs in one run that no other test could have seen.
 *
 * Turns go through the store's `pressTile`, the path a click takes; everything else - the menu,
 * the floor-clear store stop, the results screen - is the real UI. A seeded player picks a partner
 * most of the time and a wrong card otherwise.
 */

interface Snapshot {
    view: string;
    status: string | null;
    level: number;
    flipped: number;
    hidden: { id: string; k: string }[];
}

const snapshot = (page: Page): Promise<Snapshot> =>
    page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const { view, run } = useAppStore.getState();
        return {
            view,
            status: run?.status ?? null,
            level: run?.board?.level ?? 0,
            flipped: run?.board?.flippedTileIds.length ?? 0,
            hidden: (run?.board?.tiles ?? [])
                .filter((tile) => tile.state === 'hidden' && !tile.pairKey.startsWith('__'))
                .map((tile) => ({ id: tile.id, k: tile.pairKey }))
        };
    });

const playRun = async (page: Page, { missRate, maxFloor, label }: { missRate: number; maxFloor: number; label: string }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 200)}`);
    });
    const dir = `test-results/playtest/${label}`;
    mkdirSync(dir, { recursive: true });
    let shots = 0;
    const shot = (name: string) => page.screenshot({ path: `${dir}/${String(++shots).padStart(2, '0')}-${name}.png` });

    await startClassicFromMenu(page);
    await shot('floor-1');
    let seed = label.length * 7919 + 17;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let level = 1;
    let stepsOnFloor = 0;
    for (let step = 0; step < 600; step += 1) {
        const s = await snapshot(page);
        if (s.view === 'gameOver' || s.status === 'gameOver') {
            await expect(page.getByTestId('game-over-end-reason')).toBeVisible({ timeout: 30_000 });
            await shot('results');
            return { ended: 'gameOver' as const, level: s.level, errors };
        }
        if (s.level !== level) {
            level = s.level;
            stepsOnFloor = 0;
            await shot(`floor-${level}`);
            if (level > maxFloor) return { ended: 'depth' as const, level, errors };
        }
        stepsOnFloor += 1;
        expect(stepsOnFloor, `floor ${level} stalled in ${s.status}`).toBeLessThan(250);
        if (s.status === 'levelComplete') {
            const descend = page.getByRole('button', { name: /descend/i }).first();
            if (await descend.isVisible().catch(() => false)) {
                await shot(`store-after-${level}`);
                await descend.click();
            }
            await page.waitForTimeout(600);
            continue;
        }
        if (s.status !== 'playing' || s.flipped > 0) {
            await page.waitForTimeout(300);
            continue;
        }
        const first = s.hidden[Math.floor(rand() * s.hidden.length)];
        if (!first) {
            await page.waitForTimeout(300);
            continue;
        }
        const partner = s.hidden.find((tile) => tile.k === first.k && tile.id !== first.id);
        const others = s.hidden.filter((tile) => tile.k !== first.k);
        const second = rand() < missRate && others.length > 0 ? others[Math.floor(rand() * others.length)] : partner;
        if (!second) continue;
        await page.evaluate(async (ids) => {
            const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
            for (const id of ids) useAppStore.getState().pressTile(id);
        }, [first.id, second.id]);
        await page.waitForTimeout(600);
    }
    throw new Error(`${label}: the run neither ended nor reached floor ${maxFloor + 1} in 600 steps`);
};

test.describe('Playtest', () => {
    test('a careful player descends through the store stop without an error', async ({ page }) => {
        test.setTimeout(900_000);
        const result = await playRun(page, { missRate: 0.05, maxFloor: 4, label: 'careful' });
        expect(result.errors).toEqual([]);
        expect(result.ended === 'depth' || result.level >= 3, `a careful player died on floor ${result.level}`).toBe(true);
    });

    test('a sloppy player runs out of misses and the results screen says so', async ({ page }) => {
        test.setTimeout(900_000);
        const result = await playRun(page, { missRate: 0.45, maxFloor: 12, label: 'sloppy' });
        expect(result.errors).toEqual([]);
        expect(result.ended).toBe('gameOver');
        await expect(page.getByTestId('game-over-end-reason')).toHaveText(/ran out of misses/);
    });
});
