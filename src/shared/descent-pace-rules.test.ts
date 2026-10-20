import { describe, expect, it } from 'vitest';
import type { RunState } from './contracts';
import { advanceToNextLevel, createNewRun } from './game';
import { DESCENT_ACTS, DESCENT_FLOOR_COUNT } from './floor-mutator-schedule';
import { dreadForRun } from './dread-rules';
import { missesLeft } from './miss-bank';
import { FAST_DESCENT_LADDER, nextDescentLevel, withFastDescent } from './descent-pace-rules';
import { rollRealmDoors, runRealmId } from './realm-rules';

/**
 * A clear and a descent, with nothing played: the floor-to-floor bookkeeping alone. The clear rolls
 * the next floor's realm the way `finalizeLevel` does, so a walk meets the severities a run would.
 */
const descend = (run: RunState): RunState => {
    const realm = runRealmId(run);
    const nextRealm = realm ? rollRealmDoors(run.runSeed, run.board!.level, realm)[0]! : null;
    return advanceToNextLevel({ ...run, status: 'levelComplete', nextRealm });
};

const walkTo = (run: RunState, level: number): RunState => {
    let current = run;
    for (let guard = 0; guard < 200 && (current.board?.level ?? 1) < level; guard += 1) current = descend(current);
    return current;
};

describe('the test pace (fast Descent)', () => {
    it('climbs a ladder that meets every act, every act boss and the Gate’s bosses, ending on the Warden', () => {
        expect(FAST_DESCENT_LADDER[0]).toBe(1);
        expect(FAST_DESCENT_LADDER.at(-1)).toBe(DESCENT_FLOOR_COUNT);
        for (let i = 1; i < FAST_DESCENT_LADDER.length; i += 1) expect(FAST_DESCENT_LADDER[i]!).toBeGreaterThan(FAST_DESCENT_LADDER[i - 1]!);
        for (const act of DESCENT_ACTS) {
            expect(FAST_DESCENT_LADDER, `${act.title} begins`).toContain(act.firstFloor);
            if (act.bossFloor) expect(FAST_DESCENT_LADDER, `${act.title} boss`).toContain(act.bossFloor);
        }
        expect(FAST_DESCENT_LADDER).toEqual(expect.arrayContaining([7, 9]));
        expect(FAST_DESCENT_LADDER.length).toBeLessThan(20);
    });

    it('walks one floor at a time unless the run asked for the test pace', () => {
        const run = createNewRun(0, { runSeed: 8080 });
        expect(nextDescentLevel(run)).toBe(2);
        expect(descend(run).board?.level).toBe(2);
        const fast = withFastDescent(run);
        expect(fast.achievementsEnabled).toBe(false);
        let current = fast;
        const visited = [current.board!.level];
        for (let step = 1; step < FAST_DESCENT_LADDER.length; step += 1) {
            current = descend(current);
            visited.push(current.board!.level);
        }
        expect(visited).toEqual([...FAST_DESCENT_LADDER]);
        // On into Endless: the first two cycles' act starts and bosses.
        expect(nextDescentLevel(current)).toBe(61);
        expect(nextDescentLevel({ ...current, board: { ...current.board!, level: 61 } })).toBe(66);
        expect(current.board?.floorArchetypeId).toBe('warden_hall');
    });

    it('carries the same Dread a walk to the same floor would, seed for seed', () => {
        for (const runSeed of [8080, 31337, 4242]) {
            const walked = walkTo(createNewRun(0, { runSeed }), 24);
            let fast = withFastDescent(createNewRun(0, { runSeed }));
            while ((fast.board?.level ?? 1) < 24) fast = descend(fast);
            expect(fast.board?.level).toBe(24);
            expect([fast.dreadRagingFloors, fast.dreadWildFloors], `seed ${runSeed}`).toEqual([walked.dreadRagingFloors, walked.dreadWildFloors]);
            expect(dreadForRun(fast)).toBeCloseTo(dreadForRun(walked));
        }
    });

    it('keeps a miss bank grant on its shelf for the floors played, not the floor numbers jumped', () => {
        const fast = withFastDescent(createNewRun(0, { runSeed: 8080 }));
        // From floor 12: three jumps (13, 18, 24) are three floors played, as walking 13, 14, 15 is.
        const at12 = { ...fast, board: { ...fast.board!, level: 12 }, missBank: [{ floor: 11, misses: 2 }] };
        const walked = [descend({ ...at12, descentPace: null })];
        const jumped = [descend(at12)];
        for (let i = 0; i < 2; i += 1) {
            walked.push(descend(walked.at(-1)!));
            jumped.push(descend(jumped.at(-1)!));
        }
        expect(jumped.map((run) => run.board?.level)).toEqual([13, 18, 24]);
        expect(jumped.map((run) => missesLeft(run))).toEqual(walked.map((run) => missesLeft(run)));
    });
});
