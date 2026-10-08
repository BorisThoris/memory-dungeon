import { describe, expect, it } from 'vitest';

import { gameplayInteractionGraph } from './gameplay-interaction-graph';
import {
    MIN_TEST_HALL_CHECKS,
    TEST_HALL_CHECKED_ELSEWHERE,
    TEST_HALL_RESEEDS,
    TEST_HALL_ROOMS,
    testHallChecksByMechanic,
    walkTestHallRoom
} from './test-hall-rooms';

/*
 * The test hall (`test-hall-rooms.ts`): every room's walkthrough, played through the game's own
 * functions, on every commit.
 */
describe('the test hall', () => {
    for (const hallRoom of TEST_HALL_ROOMS) {
        it(`${hallRoom.id}: ${hallRoom.mechanic}`, () => {
            expect(walkTestHallRoom(hallRoom).failures).toEqual([]);
        });
        if (!hallRoom.seedPinned) {
            it(`${hallRoom.id} holds at every reseed`, () => {
                for (const runSeed of TEST_HALL_RESEEDS) {
                    expect(walkTestHallRoom(hallRoom, runSeed).failures, `seed ${runSeed}`).toEqual([]);
                }
            });
        }
    }

    it('checks every mechanic at least twice, or names where it is checked instead', () => {
        const checks = testHallChecksByMechanic();
        const short = gameplayInteractionGraph.mechanics
            .filter((mechanic) => !(mechanic.id in TEST_HALL_CHECKED_ELSEWHERE))
            .filter((mechanic) => (checks.get(mechanic.id) ?? 0) < MIN_TEST_HALL_CHECKS)
            .map((mechanic) => `${mechanic.id} (${checks.get(mechanic.id) ?? 0})`);
        expect(short).toEqual([]);
        const known = new Set(gameplayInteractionGraph.mechanics.map((mechanic) => mechanic.id));
        for (const [id, where] of Object.entries(TEST_HALL_CHECKED_ELSEWHERE)) {
            expect(known.has(id), id).toBe(true);
            // A room for it retires the exemption.
            expect(checks.get(id) ?? 0, id).toBe(0);
            expect(where.length, id).toBeGreaterThan(40);
            expect(where.endsWith('.'), id).toBe(true);
        }
    });

    it('pins a room to its own seed only with a reason', () => {
        for (const hallRoom of TEST_HALL_ROOMS) {
            if (hallRoom.seedPinned !== undefined) expect(hallRoom.seedPinned.length, hallRoom.id).toBeGreaterThan(40);
        }
        expect(TEST_HALL_ROOMS.filter((hallRoom) => hallRoom.seedPinned).length).toBeLessThanOrEqual(3);
    });

    it('gives every room an id of its own, a title, something to try and a script', () => {
        expect(new Set(TEST_HALL_ROOMS.map((hallRoom) => hallRoom.id)).size).toBe(TEST_HALL_ROOMS.length);
        for (const hallRoom of TEST_HALL_ROOMS) {
            expect(hallRoom.title.trim(), hallRoom.id).not.toBe('');
            expect(hallRoom.tryThis.trim(), hallRoom.id).not.toBe('');
            expect(hallRoom.script.length, hallRoom.id).toBeGreaterThan(0);
        }
    });

    it('names only mechanics the interaction graph has, and at least one each', () => {
        /* Bombs, the store stop and relics shipped with no graph node, and their rooms said so with
           an empty list. A room with nothing to name is a mechanic the graph cannot see. */
        const known = new Set(gameplayInteractionGraph.mechanics.map((mechanic) => mechanic.id));
        for (const hallRoom of TEST_HALL_ROOMS) {
            expect(hallRoom.graphMechanicIds.length, hallRoom.id).toBeGreaterThan(0);
            for (const id of hallRoom.graphMechanicIds) {
                expect(known.has(id), `${hallRoom.id} names ${id}`).toBe(true);
            }
        }
    });
});
