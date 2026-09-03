import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, MUTATOR_IDS, type MutatorId } from './contracts';
import {
    ENDLESS_CYCLE_FLOOR_COUNT,
    FLOOR_ARCHETYPE_CATALOG,
    pickFloorScheduleEntry
} from './floor-mutator-schedule';
import { createNewRun } from './game-core';
import { RELIC_POOL, rollRelicOptions } from './relics';
import type { FeaturedObjectiveId, RunState } from './contracts';

const FEATURED_OBJECTIVE_IDS: readonly FeaturedObjectiveId[] = [
    'scholar_style',
    'glass_witness',
    'cursed_last',
    'flip_par'
];

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

describe('content reachability census', () => {
    /**
     * Broadened after the same defect appeared twice — two wardens, then `generous_shrine`. A
     * declared id can be implemented, documented, and unit-tested in isolation while nothing ever
     * hands it to a player, and no type checks that. So every family gets walked, not just the one
     * that broke last.
     */
    it('reaches every floor archetype and every featured objective', () => {
        const archetypes = new Set<string>();
        const objectives = new Set<string>();
        for (const seed of SEEDS) {
            for (const entry of walkSchedule(seed)) {
                if (entry.floorArchetypeId) archetypes.add(entry.floorArchetypeId);
                if (entry.featuredObjectiveId) objectives.add(entry.featuredObjectiveId);
            }
        }
        const missingArchetypes = Object.keys(FLOOR_ARCHETYPE_CATALOG).filter((id) => !archetypes.has(id));
        expect(missingArchetypes, `unreachable floor archetypes: ${missingArchetypes.join(', ')}`).toEqual([]);
        const missingObjectives = FEATURED_OBJECTIVE_IDS.filter((id) => !objectives.has(id));
        expect(missingObjectives, `unreachable featured objectives: ${missingObjectives.join(', ')}`).toEqual([]);
    });

    it('offers every relic in the pool', () => {
        // The eligibility filters — scheduled-endless-only relics, contract bans, tier weighting —
        // are exactly the kind of thing that can strand an entry without anyone noticing.
        const offered = new Set<string>();
        for (let seed = 0; seed < 60; seed += 1) {
            for (let tier = 0; tier < 12; tier += 1) {
                const floor = 3 + tier * 3;
                const run = {
                    ...createNewRun(0),
                    gameMode: 'endless' as const,
                    lastLevelResult: {
                        clearLifeGained: 0,
                        clearLifeReason: 'none' as const,
                        level: floor,
                        livesRemaining: 3,
                        mistakes: 0,
                        perfect: false,
                        rating: 'A' as const,
                        scoreGained: 0
                    },
                    relicTiersClaimed: tier,
                    runRulesVersion: GAME_RULES_VERSION,
                    runSeed: 9_000 + seed,
                    status: 'levelComplete' as const
                } as unknown as RunState;
                for (const id of rollRelicOptions(run, tier, floor, 0)) {
                    offered.add(id);
                }
            }
        }
        const never = RELIC_POOL.filter((id) => !offered.has(id));
        expect(never, `relics the draft never offers: ${never.join(', ')}`).toEqual([]);
    });
});
