import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, MUTATOR_IDS, type MutatorId } from './contracts';
import { ENDLESS_CYCLE_FLOOR_COUNT, pickFloorScheduleEntry } from './floor-mutator-schedule';

/**
 * Content a player cannot reach is content that does not exist, however complete the code is.
 *
 * `generous_shrine` had working rules in `relic-offer-open-rules.ts` and `relic-offer-rules.ts`,
 * a Codex entry, and a place in `MUTATOR_IDS` — and no floor scheduled it and no mode pooled it,
 * so the extra relic pick it grants had never reached anybody. This is the check that would have
 * said so. It is the same shape as the warden-reachability problem on the boss floors.
 */

const SEEDS = [42_001, 77_707, 130_011, 420_113] as const;
const FLOORS_TO_WALK = ENDLESS_CYCLE_FLOOR_COUNT * 10;

const walkSchedule = (seed: number, floors = FLOORS_TO_WALK) =>
    Array.from({ length: floors }, (_unused, index) =>
        pickFloorScheduleEntry(seed, GAME_RULES_VERSION, index + 1, 'endless')
    );

const firstFloorFor = (seed: number): Map<MutatorId, number> => {
    const first = new Map<MutatorId, number>();
    walkSchedule(seed).forEach((entry, index) => {
        for (const mutator of entry.mutators) {
            if (!first.has(mutator)) {
                first.set(mutator, index + 1);
            }
        }
    });
    return first;
};

describe('endless floor schedule reachability', () => {
    it('reaches every declared mutator, on every seed', () => {
        for (const seed of SEEDS) {
            const first = firstFloorFor(seed);
            const unreachable = MUTATOR_IDS.filter((id) => !first.has(id));
            // Name what is stranded, so a failure says which content nobody can see.
            expect(unreachable, `seed ${seed} never schedules: ${unreachable.join(', ')}`).toEqual([]);
        }
    });

    it('reaches all but the deliberately occasional one inside a single cycle', () => {
        /*
         * `distraction_channel` is a seeded micro-variation on roughly a quarter of boss floors,
         * so it is reachable but not guaranteed early — that is a design choice, not an oversight,
         * and it is the only mutator allowed to be missing from the first cycle.
         */
        const firstCycle = new Set(
            walkSchedule(SEEDS[0], ENDLESS_CYCLE_FLOOR_COUNT).flatMap((entry) => entry.mutators)
        );
        const missing = MUTATOR_IDS.filter((id) => !firstCycle.has(id));
        expect(missing).toEqual(['distraction_channel']);
    });

    it('does not repeat a floor inside one cycle', () => {
        // Floors 3 and 10 were byte-for-byte identical, so a cycle showed the same room twice.
        const cycle = walkSchedule(SEEDS[0], ENDLESS_CYCLE_FLOOR_COUNT).map((entry) =>
            [entry.floorArchetypeId, entry.featuredObjectiveId, [...entry.mutators].sort().join('+')].join('|')
        );
        expect(new Set(cycle).size).toBe(cycle.length);
    });

    it('keeps the schedule deterministic for a given seed', () => {
        expect(walkSchedule(SEEDS[0], ENDLESS_CYCLE_FLOOR_COUNT)).toEqual(
            walkSchedule(SEEDS[0], ENDLESS_CYCLE_FLOOR_COUNT)
        );
    });
});
