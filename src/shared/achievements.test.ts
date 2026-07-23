import { describe, expect, it } from 'vitest';
import type { AchievementId, RunState } from './contracts';
import {
    ACHIEVEMENT_BY_ID,
    ACHIEVEMENTS,
    evaluateAchievementUnlocks,
    getAchievementProgressRows,
    getAchievementProgressSummary
} from './achievements';
import { createNewRun } from './game-core';
import { ACHIEVEMENT_IDS, createDefaultSaveData, createAchievementState } from './save-data';

describe('achievement catalog copy', () => {
    it('every AchievementId has non-empty title and description', () => {
        const ids = Object.keys(ACHIEVEMENT_BY_ID) as AchievementId[];
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            const a = ACHIEVEMENT_BY_ID[id];
            expect(a.id).toBe(id);
            expect(a.title.trim().length).toBeGreaterThan(0);
            expect(a.description.trim().length).toBeGreaterThan(0);
        }
        expect(ACHIEVEMENTS.length).toBe(ids.length);
    });

    it('keeps achievement catalog, display order, and default save state aligned', () => {
        expect(Object.keys(ACHIEVEMENT_BY_ID).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
        expect(ACHIEVEMENTS.map((row) => row.id)).toEqual([...ACHIEVEMENT_IDS]);
        expect(Object.keys(createAchievementState()).sort()).toEqual([...ACHIEVEMENT_IDS].sort());
    });

    it('builds bounded progress rows in achievement order', () => {
        const state = {
            ACH_FIRST_CLEAR: true,
            ACH_LEVEL_FIVE: 'yes',
            ACH_SCORE_THOUSAND: false,
            BAD_ACHIEVEMENT: true
        };
        const rows = getAchievementProgressRows(state);

        expect(rows.map((row) => row.id)).toEqual([...ACHIEVEMENT_IDS]);
        expect(rows.find((row) => row.id === 'ACH_FIRST_CLEAR')?.earned).toBe(true);
        expect(rows.find((row) => row.id === 'ACH_LEVEL_FIVE')?.earned).toBe(false);
        expect(rows.find((row) => row.id === 'ACH_SCORE_THOUSAND')?.earned).toBe(false);
        expect(getAchievementProgressSummary(state)).toEqual({ earned: 1, total: ACHIEVEMENT_IDS.length });
        expect(getAchievementProgressSummary(['ACH_FIRST_CLEAR'])).toEqual({ earned: 0, total: ACHIEVEMENT_IDS.length });
    });
});

describe('achievement rules', () => {
    it('unlocks the expected achievements from a strong run state', () => {
        const run = {
            ...createNewRun(0),
            stats: {
                ...createNewRun(0).stats,
                totalScore: 1100,
                levelsCleared: 5,
                highestLevel: 5
            },
            lastLevelResult: {
                level: 5,
                scoreGained: 100,
                rating: 'S++' as const,
                livesRemaining: 1,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 1
            }
        };
        const unlocked = evaluateAchievementUnlocks(run, createDefaultSaveData());

        expect(unlocked).toEqual([
            'ACH_FIRST_CLEAR',
            'ACH_LEVEL_FIVE',
            'ACH_SCORE_THOUSAND',
            'ACH_PERFECT_CLEAR',
            'ACH_LAST_LIFE'
        ]);
    });

    it('does not unlock perfect clear when board powers were used this run', () => {
        const run = {
            ...createNewRun(0),
            powersUsedThisRun: true,
            stats: {
                ...createNewRun(0).stats,
                totalScore: 1100,
                levelsCleared: 5,
                highestLevel: 5
            },
            lastLevelResult: {
                level: 5,
                scoreGained: 100,
                rating: 'S++' as const,
                livesRemaining: 3,
                perfect: true,
                mistakes: 0,
                clearLifeReason: 'perfect' as const,
                clearLifeGained: 0
            }
        };
        const unlocked = evaluateAchievementUnlocks(run, createDefaultSaveData());

        expect(unlocked).toEqual(['ACH_FIRST_CLEAR', 'ACH_LEVEL_FIVE', 'ACH_SCORE_THOUSAND']);
        expect(unlocked).not.toContain('ACH_PERFECT_CLEAR');
    });

    it('returns no unlocks when achievements are disabled or already earned', () => {
        const run = {
            ...createNewRun(0),
            achievementsEnabled: false,
            stats: {
                ...createNewRun(0).stats,
                levelsCleared: 1
            }
        };
        const saveData = createDefaultSaveData();
        saveData.achievements.ACH_FIRST_CLEAR = true;

        expect(evaluateAchievementUnlocks(run, saveData)).toEqual([]);
    });

    it('normalizes malformed stat counters before checking threshold achievements', () => {
        const run = {
            ...createNewRun(0),
            stats: {
                ...createNewRun(0).stats,
                totalScore: Number.POSITIVE_INFINITY,
                levelsCleared: Number.NaN,
                highestLevel: Number.POSITIVE_INFINITY
            }
        };
        const saveData = createDefaultSaveData();
        saveData.playerStats = { ...saveData.playerStats!, dailiesCompleted: Number.POSITIVE_INFINITY };

        expect(evaluateAchievementUnlocks(run, saveData)).toEqual([]);
    });

    it('normalizes malformed stat records before checking threshold achievements', () => {
        const run = {
            ...createNewRun(0),
            stats: Number.NaN
        };

        expect(evaluateAchievementUnlocks(run as unknown as RunState, createDefaultSaveData())).toEqual([]);
    });

    it('unlocks ACH_ENDLESS_TEN when endless run reaches floor 10', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            gameMode: 'endless' as const,
            stats: {
                ...base.stats,
                highestLevel: 10
            }
        };
        expect(evaluateAchievementUnlocks(run, createDefaultSaveData())).toContain('ACH_ENDLESS_TEN');
    });

    it('unlocks ACH_SEVEN_DAILIES from save progress', () => {
        const run = createNewRun(0);
        const saveData = createDefaultSaveData();
        saveData.playerStats = { ...saveData.playerStats!, dailiesCompleted: 7 };
        expect(evaluateAchievementUnlocks(run, saveData)).toContain('ACH_SEVEN_DAILIES');
    });
});
