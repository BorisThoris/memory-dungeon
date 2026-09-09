import { describe, expect, it } from 'vitest';
import { profileDeepestFloor } from './profile-deepest-floor';
import { normalizeSaveData } from './save-data';

describe('profileDeepestFloor', () => {
    it('reads the deepest floor across the last summary, the history and the no-powers record', () => {
        const base = normalizeSaveData({});
        expect(profileDeepestFloor(base)).toBe(0);

        const save = normalizeSaveData({
            ...base,
            lastRunSummary: {
                achievementsEnabled: true,
                bestScore: 10,
                bestStreak: 1,
                highestLevel: 4,
                levelsCleared: 3,
                perfectClears: 0,
                totalScore: 10,
                unlockedAchievements: []
            },
            playerStats: { bestFloorNoPowers: 2, encorePairKeysLastRun: [] },
            runHistory: [
                { endedAtIso: '2026-01-01T00:00:00.000Z', highestLevel: 7, mode: 'Classic Run', shareKey: null, totalScore: 900 }
            ]
        });
        expect(profileDeepestFloor(save)).toBe(7);
        // The history is bounded; a deeper floor that only the last summary still holds counts too.
        expect(profileDeepestFloor({ ...save, runHistory: [] })).toBe(4);
    });
});
