import { describe, expect, it } from 'vitest';

import {
    MECHANIC_CENSUS_COUNTERS,
    MECHANIC_CENSUS_EXEMPTIONS,
    auditMechanicAccountability
} from '../../scripts/mechanic-accountability';
import { gameplayInteractionGraph } from './gameplay-interaction-graph';
import { SYSTEM_OCCUPANCY_COUNTERS } from './system-occupancy-simulation';

describe('every mechanic answers for itself', () => {
    it('finds nothing on the repository as it stands', () => {
        expect(auditMechanicAccountability()).toEqual([]);
    });

    it('holds every mechanic in the graph to one of the two answers', () => {
        const answered = new Set<string>([...Object.keys(MECHANIC_CENSUS_COUNTERS), ...Object.keys(MECHANIC_CENSUS_EXEMPTIONS)]);
        const blind = /^(power|inventory|trait)\./u;
        for (const mechanic of gameplayInteractionGraph.mechanics) {
            expect(answered.has(mechanic.id) || blind.test(mechanic.id), mechanic.id).toBe(true);
        }
    });

    it('gives every exemption a reason worth reading, not a shrug', () => {
        for (const [id, reason] of Object.entries(MECHANIC_CENSUS_EXEMPTIONS)) {
            expect(reason.length, id).toBeGreaterThan(40);
            expect(reason.endsWith('.'), id).toBe(true);
        }
    });

    it('catches a mechanic that names a counter the census does not watch', () => {
        const named = new Set(Object.values(MECHANIC_CENSUS_COUNTERS).flat());
        for (const key of named) {
            expect(SYSTEM_OCCUPANCY_COUNTERS.some((counter) => counter.key === key), key).toBe(true);
        }
        // And the other way: a counter nobody claims is a counter measuring nothing.
        for (const counter of SYSTEM_OCCUPANCY_COUNTERS) {
            expect(named.has(counter.key), counter.key).toBe(true);
        }
    });

    it('records how much of the game the census can actually see', () => {
        // Not a target, a measurement: seven mechanics of forty-five, and most of the rest are
        // invisible for one reason - the census player never spends a charge or arms a power.
        const censused = Object.keys(MECHANIC_CENSUS_COUNTERS).length;
        expect(censused).toBe(15);
        expect(gameplayInteractionGraph.mechanics.length).toBe(45);
        // Gen 195 taught the census player to spend what a plain endless run hands it, which took
        // four powers and their four charges off the blind list. The eighteen left are the powers
        // a run setup grants and the four traits.
        const stillBlind = gameplayInteractionGraph.mechanics.filter(
            (mechanic) => /^(power|inventory|trait)\./u.test(mechanic.id) && MECHANIC_CENSUS_COUNTERS[mechanic.id] == null
        ).length;
        expect(stillBlind).toBe(18);
    });
});
