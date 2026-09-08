import { describe, expect, it } from 'vitest';
import { type MutatorId } from './contracts';
import { createNewRun } from './game';
import { advanceScoreParasiteFloor } from './score-parasite-rules';

describe('advanceScoreParasiteFloor', () => {
    it('increments floor pressure without life loss when score parasite is inactive', () => {
        const run = {
            ...createNewRun(0),
            lives: 2,
            parasiteFloors: 3
        };

        expect(advanceScoreParasiteFloor(run)).toEqual({
            lives: 2,
            parasiteFloors: 4
        });
    });

    it('loses one life and resets floor pressure at the score parasite threshold', () => {
        const run = {
            ...createNewRun(0),
            activeMutators: ['score_parasite'] satisfies MutatorId[],
            lives: 2,
            parasiteFloors: 3
        };

        expect(advanceScoreParasiteFloor(run)).toEqual({
            lives: 1,
            parasiteFloors: 0
        });
    });


    it('normalizes malformed counters before advancing pressure', () => {
        expect(advanceScoreParasiteFloor({
            ...createNewRun(0),
            lives: 2.9,
            parasiteFloors: Number.NaN
        })).toEqual({
            lives: 2,
            parasiteFloors: 1
        });

        expect(advanceScoreParasiteFloor({
            ...createNewRun(0),
            activeMutators: ['score_parasite'] satisfies MutatorId[],
            lives: 2.9,
            parasiteFloors: 3.9
        })).toEqual({
            lives: 1,
            parasiteFloors: 0
        });
    });
});
