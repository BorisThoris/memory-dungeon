import { describe, expect, it } from 'vitest';
import { DESCENT_ACTS } from './floor-mutator-schedule';
import { milestoneAfterClear, nextMilestone } from './milestone-rules';

describe('milestones (DGE-004)', () => {
    it('reads a proportional fraction of the act, never an absolute count', () => {
        expect(nextMilestone(6)).toMatchObject({ name: 'The Living Dungeon', floor: 12, floorsDone: 6, floorsTotal: 12, fraction: 0.5 });
        // Floor 32 is eight of the Deep's sixteen floors, measured from 24.
        expect(nextMilestone(32)).toMatchObject({ name: 'The Cartographer', floor: 40, floorsDone: 8, floorsTotal: 16, fraction: 0.5 });
        expect(nextMilestone(24)).toMatchObject({ name: 'The Keeper of Halls', floorsDone: 12, fraction: 1 });
    });

    it('names the next milestone after every clear, with the floors to go', () => {
        expect(milestoneAfterClear(9)).toMatchObject({ name: 'The Living Dungeon', floorsToGo: 3 });
        expect(milestoneAfterClear(23)).toMatchObject({ name: 'The Keeper of Halls', floorsToGo: 1 });
        // A boss cleared points at the next act's.
        expect(milestoneAfterClear(24)).toMatchObject({ name: 'The Cartographer', floor: 40, floorsToGo: 16 });
    });

    it('never shows a milestone the run cannot finish: every floor to 1000 has one ahead, at most an act away', () => {
        for (let level = 1; level <= 1000; level += 1) {
            const milestone = nextMilestone(level);
            expect(milestone.floor, `floor ${level}`).toBeGreaterThanOrEqual(level);
            expect(milestone.floor - level).toBeLessThan(20);
            expect(milestone.fraction).toBeGreaterThan(0);
            expect(milestone.fraction).toBeLessThanOrEqual(1);
        }
        // Past 60 the Warden stands every twenty floors.
        expect(nextMilestone(61)).toMatchObject({ name: 'The Warden', floor: 80, floorsDone: 1, floorsTotal: 20 });
        expect(nextMilestone(100)).toMatchObject({ floor: 100, fraction: 1 });
    });

    it('stands each milestone on its act\u2019s last floor', () => {
        for (const act of DESCENT_ACTS) expect(nextMilestone(act.firstFloor).floor).toBe(act.lastFloor);
    });
});
