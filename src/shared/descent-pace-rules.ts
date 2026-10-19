import type { RealmDoor, RunState } from './contracts';
import { countDreadFloor } from './dread-rules';
import { DESCENT_FLOOR_COUNT } from './floor-mutator-schedule';
import { carryMissBank } from './miss-bank';
import { rollRealmDoors, runRealmId } from './realm-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The test pace (2026-10-20, the owner: "make the test environment ... see all effects sooner"):
 * a run that jumps down the Descent instead of walking it, so one sitting meets every act, every
 * act boss, the Dread tiers, the milestones and the Warden.
 *
 * Everything the Descent does already reads the floor number - the schedule and its acts, the board
 * size, Dread, the milestones, the Warden - so the run simply descends to the next floor of
 * `FAST_DESCENT_LADDER` rather than the next floor. Two clocks count floors played rather than floor
 * numbers, and a jump would break them, so the jump keeps them honest:
 * - the miss bank's three-floor shelf: carried as if the next floor were the next one, then
 *   re-stamped by the floors skipped, so a grant keeps its shelf in floors played;
 * - Dread's raging and wild counts: the skipped floors are counted with the realm severities a run
 *   walking them would have met, seeded the same way (`rollRealmDoors`).
 * A test-pace run counts no achievements and no records. It is switched on by the renderer (the test
 * deployment, or `?pace=fast`), never for a shared table.
 */
export const FAST_DESCENT_LADDER: readonly number[] = [1, 2, 4, 7, 9, 12, 13, 18, 24, 25, 32, 40, 41, 50, DESCENT_FLOOR_COUNT];

export const isFastDescent = (run: Pick<RunState, 'descentPace'>): boolean => run.descentPace === 'fast';

/** The floor a cleared run descends to: the next one, or the next rung of the ladder at the test pace. */
export const nextDescentLevel = (run: Pick<RunState, 'descentPace' | 'board'>): number => {
    const level = Math.max(1, runNonNegativeInteger(run.board?.level ?? 1));
    if (!isFastDescent(run)) return level + 1;
    return FAST_DESCENT_LADDER.find((floor) => floor > level) ?? level + 1;
};

/** A run at the test pace: it jumps, and it counts nothing toward records. */
export const withFastDescent = (run: RunState): RunState =>
    run.passAndPlay ? run : { ...run, descentPace: 'fast', achievementsEnabled: false };

/**
 * After a jump from `cleared` to `next`: the miss bank as a walk would have carried it, re-stamped
 * by the floors skipped, and Dread's counts for the skipped floors. A step of one changes nothing.
 */
export const settleDescentJump = (before: RunState, after: RunState): RunState => {
    const cleared = Math.max(1, runNonNegativeInteger(before.board?.level ?? 1));
    const next = runNonNegativeInteger(after.board?.level ?? cleared + 1);
    const skipped = next - (cleared + 1);
    if (skipped <= 0) return after;
    const walked = carryMissBank(before, cleared + 1);
    const missBank = walked?.map((grant) => ({ ...grant, floor: grant.floor + skipped }));
    let counts: Pick<RunState, 'dreadRagingFloors' | 'dreadWildFloors'> = { dreadRagingFloors: after.dreadRagingFloors, dreadWildFloors: after.dreadWildFloors };
    // The clear already entered `next` through the door a walk would take into `cleared + 1`, and
    // counted it; the floors a walk would add are the ones after it, chained from that realm.
    let realm = runRealmId(after);
    if (realm) {
        for (let level = cleared + 2; level <= next; level += 1) {
            const door: RealmDoor | undefined = rollRealmDoors(before.runSeed, level - 1, realm)[0];
            if (!door) break;
            counts = countDreadFloor(counts, door.severity);
            realm = door.realmId;
        }
    }
    return { ...after, ...(missBank ? { missBank } : {}), ...counts };
};
