import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { boardDrawCallBudget } from '../src/shared/graphicsQuality';
import { startClassicFromMenu } from './playablePathHelpers';

// This suite exercises the run, while global-record.spec covers the record popup separately.
test.beforeEach(async ({ page }) => {
    await page.route('https://memory-dungeon-scores.modaxxx009.workers.dev/record', route => route.fulfill({
        json: { record: { name: 'Test Record', score: Number.MAX_SAFE_INTEGER, at: '2026-10-11T00:00:00Z' } }
    }));
});

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
    flipped: { id: string; k: string }[];
    /** `q`: a Sequences card's place in its three (`match-rule-rules.ts`). */
    hidden: { id: string; k: string; q?: number }[];
    /** The one tile a Stasis lock says cannot open a turn, if any. */
    blocked: string | null;
}

const snapshot = (page: Page): Promise<Snapshot> =>
    page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const { view, run } = useAppStore.getState();
        return {
            view,
            status: run?.status ?? null,
            level: run?.board?.level ?? 0,
            flipped: (run?.board?.tiles ?? [])
                .filter((tile) => run?.board?.flippedTileIds.includes(tile.id))
                .map((tile) => ({ id: tile.id, k: tile.pairKey })),
            blocked: run?.stickyBlockIndex != null ? run.board?.tiles[run.stickyBlockIndex]?.id ?? null : null,
            hidden: (run?.board?.tiles ?? [])
                // A frozen or vined card cannot be turned (`realm-weather-rules.ts`); a player passes it over.
                .filter((tile) => tile.state === 'hidden' && !tile.pairKey.startsWith('__') && !((tile.frost ?? 0) > 0) && tile.vined !== true)
                .map((tile) => ({ id: tile.id, k: tile.pairKey, q: tile.seq }))
        };
    });

/** Every floor the playtest reaches is held to the board's draw-call budget (`boardDrawCallBudget`). */
const expectDrawCallsWithinBudget = async (page: Page, level: number): Promise<void> => {
    await page.waitForTimeout(1200);
    const { calls, cards } = await page.evaluate(async () => {
        const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
        const canvas = document.querySelector('canvas[data-webgl-draw-calls]');
        return { calls: Number(canvas?.getAttribute('data-webgl-draw-calls') ?? 0), cards: useAppStore.getState().run?.board?.tiles.length ?? 0 };
    });
    expect(calls, `floor ${level}: ${calls} draw calls for ${cards} cards`).toBeLessThanOrEqual(boardDrawCallBudget(cards));
};

const playRun = async (
    page: Page,
    {
        missRate,
        maxFloor,
        label,
        query = '',
        maxSteps = 600,
        wardenChoice = 'win',
        wardenDoor = 'calm'
    }: { missRate: number; maxFloor: number; label: string; query?: string; maxSteps?: number; wardenChoice?: 'win' | 'endless'; wardenDoor?: 'calm' | 'raging' }
) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 200)}`);
    });
    const dir = `test-results/playtest/${label}`;
    mkdirSync(dir, { recursive: true });
    let shots = 0;
    const shot = (name: string) => page.screenshot({ path: `${dir}/${String(++shots).padStart(2, '0')}-${name}.png` });

    await startClassicFromMenu(page, query);
    await shot('floor-1');
    let seed = label.length * 7919 + 17;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let level = 1;
    let stepsOnFloor = 0;
    for (let step = 0; step < maxSteps; step += 1) {
        const s = await snapshot(page);
        if (s.view === 'gameOver' || s.status === 'gameOver') {
            // The run ends on its cinematic (`RunEndCinematic`); the results screen is one press on, as a player takes it.
            await shot('run-end');
            const results = page.getByRole('button', { name: /^results/i });
            await expect(results).toBeVisible({ timeout: 30_000 });
            await results.click();
            await expect(page.getByTestId('game-over-end-reason')).toBeVisible({ timeout: 30_000 });
            await shot('results');
            return { ended: 'gameOver' as const, level: s.level, errors };
        }
        if (s.level !== level) {
            level = s.level;
            stepsOnFloor = 0;
            await shot(`floor-${level}`);
            await expectDrawCallsWithinBudget(page, level);
            if (level > maxFloor) return { ended: 'depth' as const, level, errors };
        }
        stepsOnFloor += 1;
        expect(stepsOnFloor, `floor ${level} stalled in ${s.status}`).toBeLessThan(250);
        if (s.status === 'levelComplete') {
            // The Warden's clear asks (DGE-006): the player takes the win, or descends into Endless.
            const choice = page
                .getByTestId('warden-choice')
                .getByRole('button', { name: wardenChoice === 'win' ? 'Take the win' : 'Descend into Endless' });
            if (await choice.isVisible().catch(() => false)) {
                await shot(`warden-choice-after-${level}`);
                await choice.click();
                await page.waitForTimeout(600);
                continue;
            }
            const descend = page.getByRole('button', { name: /descend/i }).first();
            if (await descend.isVisible().catch(() => false)) {
                await shot(`store-after-${level}`);
                await descend.click();
            }
            // The travel doors (`realm-rules.ts`): pick one, the way a player picks where to go. Before the
            // Warden this player takes the calm door: behind the others the Warden falls only to a Hold of
            // twelve (DGE-023), which this player does not build.
            const wardenNext = await page.evaluate(async () => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const { nextDescentLevel } = await import('/src/shared/descent-pace-rules.ts');
                const { descentActForLevel, isActBossLevel } = await import('/src/shared/floor-mutator-schedule.ts');
                const run = useAppStore.getState().run;
                if (!run?.board) return false;
                const next = nextDescentLevel(run);
                // The Warden's floor is 40 on the forty-floor Descent (`descent-length-rules.ts`): ask the run's own rules.
                return isActBossLevel(next, run.runRulesVersion) && descentActForLevel(next, run.runRulesVersion).id === 'abyss';
            });
            // Or, asked to (DGE-023), it takes the raging door - the wild one when no door rages - and meets the complete Warden.
            const wantedDoor = wardenDoor === 'calm'
                ? page.locator('[data-testid^="realm-door-"][data-severity="calm"]').first()
                : (await page.locator('[data-testid^="realm-door-"][data-severity="raging"]').first().isVisible().catch(() => false))
                  ? page.locator('[data-testid^="realm-door-"][data-severity="raging"]').first()
                  : page.locator('[data-testid^="realm-door-"][data-severity="wild"]').first();
            const door = wardenNext && (await wantedDoor.isVisible().catch(() => false)) ? wantedDoor : page.getByTestId(`realm-door-${Math.floor(rand() * 3)}`);
            if (await door.isVisible().catch(() => false)) {
                await shot(`travel-after-${level}`);
                await door.click();
            }
            await page.waitForTimeout(600);
            continue;
        }
        if (s.status !== 'playing') {
            await page.waitForTimeout(300);
            continue;
        }
        const press = (ids: string[]) =>
            page.evaluate(async (tileIds) => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                for (const id of tileIds) useAppStore.getState().pressTile(id);
            }, ids);
        /*
         * A turn left with one card up - a press refused by a Stasis lock leaves the next press as the
         * opener - is finished the way a player finishes it: turn a second card.
         */
        const open = s.flipped[0];
        if (open && s.flipped.length === 1) {
            const match = s.hidden.find((tile) => tile.k === open.k);
            const any = s.hidden[Math.floor(rand() * s.hidden.length)];
            const second = rand() < missRate ? any : match ?? any;
            if (second) await press([second.id]);
            await page.waitForTimeout(600);
            continue;
        }
        // Triples (`match-rule-rules.ts`): two of a three wait face up in play; a player turns the third.
        if (s.flipped.length === 2 && s.flipped[0]!.k === s.flipped[1]!.k) {
            const third = s.hidden.find((tile) => tile.k === s.flipped[0]!.k);
            const any = s.hidden[Math.floor(rand() * s.hidden.length)];
            const pick = rand() < missRate ? any : third ?? any;
            if (pick) await press([pick.id]);
            await page.waitForTimeout(600);
            continue;
        }
        if (s.flipped.length > 0) {
            await page.waitForTimeout(300);
            continue;
        }
        // Behind the raging door the Warden falls only to a Hold of twelve (DGE-023): this player holds once the
        // Hold arms, and releases at twelve, through the store's own actions, as the dock's button would.
        if (wardenDoor === 'raging') {
            const held = await page.evaluate(async () => {
                const { useAppStore } = await import('/src/renderer/store/useAppStore.ts');
                const { wardenTestHolds, WARDEN_FELL_PAIRS } = await import('/src/shared/warden-rules.ts');
                const { canStartHold, heldPairCount } = await import('/src/shared/hold-rules.ts');
                const store = useAppStore.getState();
                const run = store.run;
                if (!run?.board || !wardenTestHolds(run)) return 'none';
                if (run.holding && heldPairCount(run) >= WARDEN_FELL_PAIRS) {
                    store.releaseHold();
                    return 'released';
                }
                if (!run.holding && canStartHold(run)) {
                    store.startHold();
                    return 'started';
                }
                return 'none';
            });
            if (held !== 'none') {
                await shot(`hold-${held}-${level}`);
                await page.waitForTimeout(600);
                continue;
            }
        }
        // A Stasis lock keeps one tile from opening a turn; a player opens elsewhere.
        const openers = s.hidden.filter((tile) => tile.id !== s.blocked);
        const picked = openers[Math.floor(rand() * openers.length)];
        // Sequences: a player who knows a three opens it with its one, then turns its two.
        const first = picked?.q != null ? openers.find((tile) => tile.k === picked.k && tile.q === 1) ?? picked : picked;
        if (!first) {
            await page.waitForTimeout(300);
            continue;
        }
        const partner = s.hidden.find((tile) => tile.k === first.k && tile.id !== first.id && (first.q == null || tile.q === first.q + 1));
        const others = s.hidden.filter((tile) => tile.k !== first.k);
        const second = rand() < missRate && others.length > 0 ? others[Math.floor(rand() * others.length)] : partner;
        if (!second) continue;
        await press([first.id, second.id]);
        await page.waitForTimeout(600);
    }
    throw new Error(`${label}: the run neither ended nor reached floor ${maxFloor + 1} in ${maxSteps} steps`);
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

    /*
     * The test pace (`descent-pace-rules.ts`, `?pace=fast`): a careful tester jumps the Descent's ladder from
     * the main menu - every act, the Keeper, the Cartographer - to the Warden, and wins. A screenshot of every
     * floor shows the act bosses, Dread climbing its tiers, the milestones and the Warden's rules.
     */
    test('a tester at the test pace descends every act to the Warden and wins', async ({ page }) => {
        test.setTimeout(2_400_000);
        const result = await playRun(page, { missRate: 0.02, maxFloor: 99, label: 'test-pace', query: 'pace=fast', maxSteps: 2400 });
        expect(result.errors).toEqual([]);
        expect(result.ended).toBe('gameOver');
        expect(result.level).toBe(40);
        await expect(page.getByTestId('game-over-end-reason')).toHaveText(/The Descent is won/);
    });

    /*
     * The complete Warden (DGE-023): the same tester takes the raging door before floor 40 (the forty-floor Descent, rules 93), where the Warden falls
     * only to a Hold released at twelve pairs; it holds once the Hold arms and releases at twelve, and the results
     * screen says how the Warden fell.
     */
    test('a tester at the test pace takes the raging door and fells the complete Warden with a Hold', async ({ page }) => {
        test.setTimeout(2_400_000);
        const result = await playRun(page, { missRate: 0.02, maxFloor: 99, label: 'test-pace-raging', query: 'pace=fast', maxSteps: 2400, wardenDoor: 'raging' });
        expect(result.errors).toEqual([]);
        expect(result.ended).toBe('gameOver');
        expect(result.level).toBe(40);
        await expect(page.getByTestId('game-over-end-reason')).toHaveText(/The Descent is won/);
        await expect(page.getByTestId('game-over-warden')).toHaveText(/Felled by a Hold/);
    });

    /*
     * Endless (DGE-006): the same tester descends past the Warden instead, and plays the first Endless cycle's
     * act starts and bosses to its own Warden on floor 70 (90 on the sixty-floor Descent) - bigger boards, the acts again, shorter.
     */
    test('a tester at the test pace goes on into Endless and plays its first cycle', async ({ page }) => {
        test.setTimeout(3_000_000);
        const result = await playRun(page, { missRate: 0.02, maxFloor: 69, label: 'test-pace-endless', query: 'pace=fast', maxSteps: 4000, wardenChoice: 'endless' });
        expect(result.errors).toEqual([]);
        expect(result.ended).toBe('depth');
        expect(result.level).toBe(70);
    });
});
