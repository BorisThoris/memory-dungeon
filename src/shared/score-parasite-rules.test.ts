import { describe, expect, it } from 'vitest';
import { type MutatorId, type RelicId } from './contracts';
import { createNewRun } from './game';
import {
    advanceScoreParasiteFloor,
    getParasiteFloorsAfterFeaturedObjectiveClear
} from './score-parasite-rules';

describe('advanceScoreParasiteFloor', () => {
    it('increments floor pressure without life loss when score parasite is inactive', () => {
        const run = {
            ...createNewRun(0),
            lives: 2,
            parasiteFloors: 3,
            parasiteWardRemaining: 0
        };

        expect(advanceScoreParasiteFloor(run)).toEqual({
            lives: 2,
            parasiteFloors: 4,
            parasiteWardRemaining: 0
        });
    });

    it('loses one life and resets floor pressure at the score parasite threshold', () => {
        const run = {
            ...createNewRun(0),
            activeMutators: ['score_parasite'] satisfies MutatorId[],
            lives: 2,
            parasiteFloors: 3,
            parasiteWardRemaining: 0
        };

        expect(advanceScoreParasiteFloor(run)).toEqual({
            lives: 1,
            parasiteFloors: 0,
            parasiteWardRemaining: 0
        });
    });

    it('spends a parasite ward before losing life', () => {
        const run = {
            ...createNewRun(0),
            activeMutators: ['score_parasite'] satisfies MutatorId[],
            lives: 2,
            parasiteFloors: 3,
            parasiteWardRemaining: 1
        };

        expect(advanceScoreParasiteFloor(run)).toEqual({
            lives: 2,
            parasiteFloors: 0,
            parasiteWardRemaining: 0
        });
    });
});

describe('getParasiteFloorsAfterFeaturedObjectiveClear', () => {
    it('reduces parasite pressure when parasite ledger rewards a completed featured objective', () => {
        const run = {
            ...createNewRun(0),
            activeMutators: ['score_parasite'] satisfies MutatorId[],
            relicIds: ['parasite_ledger'] satisfies RelicId[],
            parasiteFloors: 3
        };

        expect(getParasiteFloorsAfterFeaturedObjectiveClear(run, true)).toBe(2);
    });

    it('does not reduce parasite pressure without completion, relic, or mutator', () => {
        const run = {
            ...createNewRun(0),
            activeMutators: ['score_parasite'] satisfies MutatorId[],
            parasiteFloors: 3
        };

        expect(getParasiteFloorsAfterFeaturedObjectiveClear(run, false)).toBe(3);
        expect(getParasiteFloorsAfterFeaturedObjectiveClear(run, true)).toBe(3);
        expect(getParasiteFloorsAfterFeaturedObjectiveClear({
            ...run,
            relicIds: ['parasite_ledger'] satisfies RelicId[],
            activeMutators: []
        }, true)).toBe(3);
    });
});
