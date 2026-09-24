import { describe, expect, it } from 'vitest';

import { gameplayInteractionGraph } from './gameplay-interaction-graph';
import { TEST_HALL_ROOMS, walkTestHallRoom } from './test-hall-rooms';

/*
 * The test hall (`test-hall-rooms.ts`): every room's walkthrough, played through the game's own
 * functions, on every commit.
 */
describe('the test hall', () => {
    for (const hallRoom of TEST_HALL_ROOMS) {
        it(`${hallRoom.id}: ${hallRoom.mechanic}`, () => {
            expect(walkTestHallRoom(hallRoom).failures).toEqual([]);
        });
    }

    it('gives every room an id of its own, a title, something to try and a script', () => {
        expect(new Set(TEST_HALL_ROOMS.map((hallRoom) => hallRoom.id)).size).toBe(TEST_HALL_ROOMS.length);
        for (const hallRoom of TEST_HALL_ROOMS) {
            expect(hallRoom.title.trim(), hallRoom.id).not.toBe('');
            expect(hallRoom.tryThis.trim(), hallRoom.id).not.toBe('');
            expect(hallRoom.script.length, hallRoom.id).toBeGreaterThan(0);
        }
    });

    it('names only mechanics the interaction graph has', () => {
        const known = new Set(gameplayInteractionGraph.mechanics.map((mechanic) => mechanic.id));
        for (const hallRoom of TEST_HALL_ROOMS) {
            for (const id of hallRoom.graphMechanicIds) {
                expect(known.has(id), `${hallRoom.id} names ${id}`).toBe(true);
            }
        }
    });
});
