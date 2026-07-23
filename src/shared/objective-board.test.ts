import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { createNewRun } from './game-core';
import { buildObjectiveBoardRows, buildRunObjectiveProgressRows, getObjectiveBoardItems, objectiveBoardSummary } from './objective-board';

describe('REG-021 objective board', () => {
    it('projects active, completed, and locked objective states from local save data', () => {
        const empty = createDefaultSaveData();
        const emptyItems = getObjectiveBoardItems(empty);

        expect(emptyItems.map((item) => item.status)).toEqual([
            'active',
            'active',
            'active',
            'locked'
        ]);
        expect(objectiveBoardSummary(empty)).toEqual({ total: 4, completed: 0, active: 3, locked: 1 });

        const progressed = createDefaultSaveData();
        progressed.achievements.ACH_FIRST_CLEAR = true;
        progressed.playerStats = {
            ...progressed.playerStats!,
            bestFloorNoPowers: 5,
            dailiesCompleted: 2,
            dailyStreakCosmetic: 2
        };
        const items = getObjectiveBoardItems(progressed);

        expect(items.find((item) => item.id === 'first_clear')?.status).toBe('completed');
        expect(items.find((item) => item.id === 'no_powers_floor_5')?.status).toBe('completed');
        expect(items.find((item) => item.id === 'daily_three')?.progress).toEqual({ current: 2, target: 3 });
        expect(items.find((item) => item.id === 'daily_three')?.status).toBe('active');
        expect(items.find((item) => item.id === 'relic_shrine_extra')?.status).toBe('locked');
    });

    it('normalizes malformed pin vow counters before projecting run progress rows', () => {
        const run = {
            ...createNewRun(0),
            activeContract: { noDestroy: false, noShuffle: false, maxMismatches: null, maxPinsTotalRun: 1.9 },
            pinsPlacedCountThisRun: Number.POSITIVE_INFINITY
        };

        expect(buildRunObjectiveProgressRows(run).find((row) => row.id === 'pin_vow')).toMatchObject({
            state: 'active',
            detail: '0/1 pins'
        });
    });

    it('normalizes malformed saved counters before projecting objective progress', () => {
        const save = createDefaultSaveData();
        save.achievements.ACH_FIRST_CLEAR = true;
        save.playerStats = {
            ...save.playerStats!,
            bestFloorNoPowers: Number.POSITIVE_INFINITY,
            dailiesCompleted: Number.NaN,
            relicPickCounts: { guard_token_plus_one: Number.POSITIVE_INFINITY, parasite_ledger: 1.9 }
        };
        save.lastRunSummary = {
            totalScore: 0,
            bestScore: 0,
            levelsCleared: Number.POSITIVE_INFINITY,
            highestLevel: 0,
            achievementsEnabled: true,
            unlockedAchievements: [],
            bestStreak: 0,
            perfectClears: 0,
            gameMode: 'gauntlet'
        };

        expect(buildObjectiveBoardRows(save).map((row) => `${row.id}:${row.progress}`)).toEqual([
            'first_clear:1/1',
            'no_powers_floor_5:0/5',
            'daily_initiate:0/1',
            'relic_habit:1/10',
            'gauntlet_proof:0/1'
        ]);
        expect(getObjectiveBoardItems(save).find((item) => item.id === 'daily_three')?.progress).toEqual({
            current: 0,
            target: 3
        });
    });
});
