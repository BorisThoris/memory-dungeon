import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import {
    applyFloorCurio,
    FLOOR_CURIOS,
    getFloorCurio,
    MIN_CURIO_MEMORIZE_MS,
    pickFloorCurio,
    type FloorCurio
} from './floor-curio-rules';

/** A run standing at the top of a floor with a memorize window already ticking on it. */
const run = (memorizeRemainingMs: number | null = 6_000) => {
    const base = createNewRun(0, { runSeed: 7_001 });
    return { ...base, timerState: { ...base.timerState, memorizeRemainingMs } };
};
const curio = (id: FloorCurio['id']): FloorCurio => getFloorCurio(id)!;

describe('the cast', () => {
    it('gives every resident a name, a line and a summary of what they do', () => {
        for (const resident of FLOOR_CURIOS) {
            expect(resident.name.length, resident.id).toBeGreaterThan(3);
            expect(resident.line.length, resident.id).toBeGreaterThan(20);
            expect(resident.effectSummary.length, resident.id).toBeGreaterThan(10);
        }
    });

    it('has no two residents with the same id', () => {
        expect(new Set(FLOOR_CURIOS.map((r) => r.id)).size).toBe(FLOOR_CURIOS.length);
    });

    it('is a cast rather than a stat screen: one of them does nothing at all', () => {
        const idle = FLOOR_CURIOS.filter((r) => Object.values(r.effect).every((value) => value === 0));
        expect(idle.length).toBeGreaterThan(0);
    });

    it('never leaves a floor worse off on more than one axis, since the dungeon is hard enough', () => {
        for (const resident of FLOOR_CURIOS) {
            const costs = Object.values(resident.effect).filter((value) => value < 0);
            expect(costs.length, resident.id).toBeLessThanOrEqual(1);
        }
    });
});

describe('who is on this floor', () => {
    it('is the same resident on a replay of the same run', () => {
        expect(pickFloorCurio(4242, 3, 1).id).toBe(pickFloorCurio(4242, 3, 1).id);
    });

    it('changes floor to floor, so a descent is populated rather than haunted by one character', () => {
        const met = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => pickFloorCurio(4242, level, 1).id));
        expect(met.size).toBeGreaterThan(1);
    });

    it('differs between runs, so two players do not meet the same floor', () => {
        const seeds = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => pickFloorCurio(seed, 1, 1).id));
        expect(seeds.size).toBeGreaterThan(1);
    });

    it('always returns someone', () => {
        expect(pickFloorCurio(Number.NaN, 1, 1)).toBeDefined();
    });
});

describe('what they actually do', () => {
    it('the torchbearer buys a longer look and a peek, on this floor rather than the next', () => {
        const before = run();
        const after = applyFloorCurio(before, curio('nervous_torchbearer'));
        expect(after.timerState.memorizeRemainingMs).toBeGreaterThan(before.timerState.memorizeRemainingMs!);
        expect(after.peekCharges).toBe(before.peekCharges + 1);
        // `pendingMemorizeBonusMs` is spent by the NEXT transition. Writing there would give the
        // longer look to a floor the torchbearer is not standing on.
        expect(after.pendingMemorizeBonusMs).toBe(before.pendingMemorizeBonusMs);
    });

    it('the rat leaves coins', () => {
        expect(applyFloorCurio(run(), curio('hoarding_rat')).shopGold).toBe(run().shopGold + 3);
    });

    it('the off-duty guard hands over a token, which is the one thing that stops the magpie', () => {
        const after = applyFloorCurio(run(), curio('off_duty_guard'));
        expect(after.stats.guardTokens).toBe(run().stats.guardTokens + 1);
    });

    it('the skull costs attention and pays in gossip-adjacent coins', () => {
        const before = run();
        const after = applyFloorCurio(before, curio('gossiping_skull'));
        expect(after.timerState.memorizeRemainingMs).toBeLessThan(before.timerState.memorizeRemainingMs!);
        expect(after.shopGold).toBeGreaterThan(before.shopGold);
    });

    it('the sock does nothing, on purpose', () => {
        const before = run();
        const after = applyFloorCurio(before, curio('lost_sock'));
        expect(after.peekCharges).toBe(before.peekCharges);
        expect(after.shopGold).toBe(before.shopGold);
        expect(after.stats.guardTokens).toBe(before.stats.guardTokens);
        expect(after.timerState.memorizeRemainingMs).toBe(before.timerState.memorizeRemainingMs);
    });

    it('never shortens a window past the point where the floor could be read', () => {
        // Deep floors have short windows to begin with; -600ms out of 1s is a different game.
        const after = applyFloorCurio({ ...run(900), shopGold: 0 }, curio('gossiping_skull'));
        expect(after.timerState.memorizeRemainingMs).toBe(MIN_CURIO_MEMORIZE_MS);
        expect(after.shopGold).toBeGreaterThanOrEqual(0);
    });

    it('leaves a mode with no memorize clock alone rather than inventing one', () => {
        expect(applyFloorCurio(run(null), curio('nervous_torchbearer')).timerState.memorizeRemainingMs).toBeNull();
    });

    it('records who was met, so the floor can say so', () => {
        expect(applyFloorCurio(run(), curio('hoarding_rat')).floorCurioId).toBe('hoarding_rat');
    });
});

describe('they actually move in', () => {
    it('is on the floor a run advances to, not only in the catalog', async () => {
        // The reachability question this project keeps failing: content that exists, is tested, and
        // that nothing ever hands to a player. A resident is on every floor a run reaches.
        const { createNextFloorRunState } = await import('./next-floor-run-state-rules');
        const base = run();
        const next = createNextFloorRunState(base, {
            board: { ...base.board!, level: 2 },
            lives: base.lives,
            activeMutators: [],
            dungeonRun: base.dungeonRun,
            parasiteFloors: 0,
            parasiteWardRemaining: 0
        } as unknown as Parameters<typeof createNextFloorRunState>[1]);

        expect(next.floorCurioId).toBeTruthy();
        expect(FLOOR_CURIOS.map((resident) => resident.id)).toContain(next.floorCurioId);
    });

    it('is a cast a real descent meets in full, not four of six and two on paper', () => {
        // Reachable in principle is not reachable. Walk a run's floors the way a player would and
        // require every resident to actually turn up.
        const met = new Set<string>();
        for (const runSeed of [7_001, 15_487, 903_221]) {
            for (let level = 2; level <= 40; level += 1) {
                met.add(pickFloorCurio(runSeed, level, 1).id);
            }
        }
        expect([...met].sort()).toEqual(FLOOR_CURIOS.map((resident) => resident.id).sort());
    });

    it('meets the resident the seed chose for that floor', async () => {
        const { createNextFloorRunState } = await import('./next-floor-run-state-rules');
        const base = run();
        const next = createNextFloorRunState(base, {
            board: { ...base.board!, level: 4 },
            lives: base.lives,
            activeMutators: [],
            dungeonRun: base.dungeonRun,
            parasiteFloors: 0,
            parasiteWardRemaining: 0
        } as unknown as Parameters<typeof createNextFloorRunState>[1]);

        expect(next.floorCurioId).toBe(pickFloorCurio(base.runSeed, 4, base.runRulesVersion).id);
    });
});

